import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { sha, groups, inside, lockPath, readJson, saveJson, packGroup, restoreAssets } from './asset-bundles.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [action = 'restore', ...args] = process.argv.slice(2)
const selected = args.find(arg => !arg.startsWith('--'))
const run = params => {
  const result = spawnSync('gh', params, { cwd: root, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'GitHub CLI failed')
  return result.stdout
}
if (action === 'restore') await restoreAssets(root, { force: args.includes('--force') })
else if (action === 'pack') {
  for (const kind of selected ? [selected] : Object.keys(groups)) console.log(await packGroup(root, kind))
} else if (action === 'publish') {
  const lock = await readJson(inside(root, lockPath)), tag = 'data-assets'
  const kinds = selected ? [selected] : Object.keys(lock.bundles)
  for (const kind of kinds) {
    const b = lock.bundles[kind]; if (!b || !/^(game|ratings)-[a-f0-9]{20}\.ndjson\.gz$/.test(b.file) || !existsSync(inside(root, 'tools/.tmp/asset-bundles/' + b.file))) throw new Error('Pack this group first: ' + kind)
    if (sha(await readFile(inside(root, 'tools/.tmp/asset-bundles/' + b.file))) !== b.sha256) throw new Error('Local bundle hash mismatch: ' + kind)
  }
  const view = spawnSync('gh', ['release', 'view', tag], { cwd: root, windowsHide: true, encoding: 'utf8' })
  if (view.status !== 0) run(['release', 'create', tag, '--target', run(['api', 'repos/iyuangang/dove-wiki/commits/main', '--jq', '.sha']).trim(), '--title', 'Wiki generated data assets', '--notes', 'Content-addressed build inputs for the wiki. Site releases are published separately.', '--prerelease', '--latest=false'])
  const release = JSON.parse(run(['release', 'view', tag, '--json', 'assets']))
  for (const kind of kinds) {
    const b = lock.bundles[kind], existing = release.assets.find(a => a.name === b.file)
    if (existing && existing.digest !== 'sha256:' + b.sha256) throw new Error('Remote asset with same name has different hash; refusing overwrite')
    if (!existing) run(['release', 'upload', tag, inside(root, 'tools/.tmp/asset-bundles/' + b.file)])
    b.url = `https://github.com/iyuangang/dove-wiki/releases/download/${tag}/${b.file}`
  }
  await saveJson(inside(root, lockPath), lock); console.log('Published immutable asset bundles; commit data/asset-lock.json with the matching data manifests.')
} else throw new Error('Usage: node tools/assets.mjs restore [--force] | pack [game|ratings] | publish [game|ratings]')
