import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, readdir, lstat, stat, rename, rm, copyFile, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { createGzip, createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

export const groups = {
  game: ['public/encyclopedia', 'public/skills', 'public/portraits', 'public/heroes', 'public/enemies', 'public/technologies', 'public/damage-types'],
  ratings: ['public/rating'],
}
const sourceInputs = { game: ['src/data/dove-data.json', 'src/data/snapshot-manifest.json'], ratings: ['src/data/rating-manifest.json', 'src/data/rating-methodology.json'] }
export const lockPath = 'data/asset-lock.json'
export const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
export async function saveJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file + '.pending', JSON.stringify(data, null, 2) + '\n'); await rename(file + '.pending', file)
}
export function inside(root, local) {
  const target = path.resolve(root, local), relative = path.relative(path.resolve(root), target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe asset path: ' + local)
  return target
}
export function validPath(local, kind) {
  return typeof local === 'string' && !/[\\:\x00]/.test(local) && !local.split('/').some(p => !p || p === '.' || p === '..') &&
    groups[kind]?.some(root => local.startsWith(root + '/'))
}
async function entries(root, local) {
  const result = []
  for (const entry of await readdir(inside(root, local), { withFileTypes: true })) {
    const name = local + '/' + entry.name
    if (entry.isSymbolicLink()) throw new Error('Symlink in generated assets: ' + name)
    if (entry.isDirectory()) result.push(...await entries(root, name))
    else if (entry.isFile()) { const bytes = await readFile(inside(root, name)); result.push({ path: name, bytes: bytes.length, sha256: sha(bytes) }) }
  }
  return result
}
export async function packGroup(root, kind) {
  if (!groups[kind]) throw new Error('Unknown asset group: ' + kind)
  const files = (await Promise.all(groups[kind].map(local => entries(root, local)))).flat().sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  if (!files.length) throw new Error('Empty asset group: ' + kind)
  const treeSha256 = sha(JSON.stringify(files)), file = `${kind}-${treeSha256.slice(0,20)}.ndjson.gz`
  const directory = inside(root, 'tools/.tmp/asset-bundles'); await mkdir(directory, { recursive: true })
  const output = path.join(directory, file), gzip = createGzip({ level: 9 })
  const finished = pipeline(gzip, createWriteStream(output + '.pending'))
  const put = async value => { if (!gzip.write(JSON.stringify(value) + '\n')) await once(gzip, 'drain') }
  try {
    await put({ schema: 1, kind, treeSha256, files })
    for (const item of files) {
      const bytes = await readFile(inside(root, item.path))
      if (sha(bytes) !== item.sha256) throw new Error('Assets changed during packing: ' + item.path)
      await put({ path: item.path, data: bytes.toString('base64') })
    }
    gzip.end(); await finished; await rename(output + '.pending', output)
  } catch (error) { gzip.destroy(error); await finished.catch(() => {}); throw error }
  const bytes = await readFile(output), digest = sha(bytes)
  const cache = inside(root, `tools/.tmp/asset-cache/${digest}.ndjson.gz`); await mkdir(path.dirname(cache), { recursive: true }); await copyFile(output, cache)
  const lockFile = inside(root, lockPath), lock = existsSync(lockFile) ? await readJson(lockFile) : { schema: 1, bundles: {} }
  const inputs = {}
  for (const input of sourceInputs[kind]) if (existsSync(inside(root, input))) inputs[input] = sha(await readFile(inside(root, input)))
  const previous = lock.bundles[kind]
  lock.bundles[kind] = { inputs, file, sha256: digest, treeSha256, files: files.length, bytes: bytes.length, url: previous?.sha256 === digest ? previous.url : null }
  await saveJson(lockFile, lock)
  const stateFile = inside(root, 'tools/.tmp/asset-state.json'), state = existsSync(stateFile) ? await readJson(stateFile) : {}
  state[kind] = digest; await saveJson(stateFile, state)
  return { ...lock.bundles[kind], output }
}
export async function unpackGroup(root, kind, bundle, archive) {
  if (!groups[kind] || sha(await readFile(archive)) !== bundle.sha256) throw new Error('Asset bundle SHA-256 mismatch: ' + kind)
  const temp = inside(root, 'tools/.tmp/assets-' + randomUUID()); await mkdir(temp, { recursive: true })
  const stage = path.join(temp, 'stage'), backup = path.join(temp, 'backup'), promoted = []
  await mkdir(stage, { recursive: true })
  const input = createReadStream(archive), unzip = createGunzip()
  input.pipe(unzip); input.on('error', error => unzip.destroy(error))
  const lines = createInterface({ input: unzip, crlfDelay: Infinity })
  let header, expected, count = 0, total = 0, keepBackup = false
  try {
    for await (const line of lines) {
      const row = JSON.parse(line)
      if (!header) {
        header = row
        if (row.schema !== 1 || row.kind !== kind || row.treeSha256 !== bundle.treeSha256 || sha(JSON.stringify(row.files)) !== row.treeSha256 || row.files.length !== bundle.files || row.files.length > 50000) throw new Error('Invalid asset index')
        expected = new Map()
        for (const f of row.files) {
          if (!validPath(f.path, kind) || expected.has(f.path) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 || f.bytes > 32*1024*1024 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid asset entry: ' + f.path)
          expected.set(f.path, f)
        }
        continue
      }
      const entry = expected.get(row.path)
      if (!entry || typeof row.data !== 'string') throw new Error('Unexpected or repeated asset: ' + row.path)
      const bytes = Buffer.from(row.data, 'base64'); total += bytes.length
      if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256 || total > 1024*1024*1024) throw new Error('Invalid asset content: ' + row.path)
      const target = inside(stage, row.path); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' })
      expected.delete(row.path); count++
    }
    if (!header || expected.size || count !== bundle.files) throw new Error('Truncated asset bundle')
    for (const local of groups[kind]) {
      const target = inside(root, local), old = inside(backup, local), source = inside(stage, local)
      if (!existsSync(source)) throw new Error('Missing asset directory: ' + local)
      const hadTarget = existsSync(target)
      if (hadTarget && (await lstat(target)).isSymbolicLink()) throw new Error('Refuse to replace symlink: ' + local)
      await mkdir(path.dirname(old), { recursive: true }); await mkdir(path.dirname(target), { recursive: true })
      if (hadTarget) await rename(target, old)
      promoted.push({ target, old, hadTarget })
      await rename(source, target)
    }
  } catch (error) {
    try {
      for (const item of promoted.reverse()) {
        await rm(item.target, { recursive: true, force: true }); if (item.hadTarget) await rename(item.old, item.target)
      }
    } catch (rollback) { keepBackup = true; throw new AggregateError([error, rollback], 'Asset restore failed; backups retained at ' + temp) }
    throw error
  } finally { lines.close(); input.destroy(); unzip.destroy(); if (!keepBackup) await rm(inside(root, path.relative(root, temp)), { recursive: true, force: true }) }
}
export async function downloadBundle(bundle, cache, request = fetch) {
  const partial = cache + '.pending'
  let lastError
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      let offset = existsSync(partial) ? (await stat(partial)).size : 0
      if (offset === bundle.bytes) {
        if (sha(await readFile(partial)) === bundle.sha256) { await rename(partial, cache); return }
        await rm(partial); offset = 0
      }
      if (offset > bundle.bytes) { await rm(partial); offset = 0 }
      const response = await request(bundle.url, { headers: offset ? { Range: `bytes=${offset}-` } : {} })
      if (!response.ok || !response.body) throw new Error(`Asset download failed: HTTP ${response.status}`)
      if (offset && response.status === 206) {
        if (!response.headers.get('content-range')?.startsWith(`bytes ${offset}-`)) throw new Error('Invalid download range')
      } else offset = 0
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: offset ? 'a' : 'w' }))
      if ((await stat(partial)).size !== bundle.bytes || sha(await readFile(partial)) !== bundle.sha256) {
        await rm(partial); throw new Error('Downloaded asset bundle SHA-256 mismatch')
      }
      await rename(partial, cache); return
    } catch (error) {
      lastError = error
      if (attempt < 5) { console.log(`[assets] Retrying download (${attempt+1}/5): ${bundle.file}`); await new Promise(resolve => setTimeout(resolve, (attempt+1)*500)) }
    }
  }
  throw new Error('Asset download interrupted; rerun to resume: ' + bundle.file, { cause: lastError })
}

async function countFiles(root, local) {
  let count = 0
  for (const item of await readdir(inside(root, local), { withFileTypes: true })) {
    if (item.isSymbolicLink()) return -100000
    if (item.isDirectory()) count += await countFiles(root, local + '/' + item.name)
    else if (item.isFile()) count++
  }
  return count
}

export async function restoreAssets(root, { force = false } = {}) {
  const lock = await readJson(inside(root, lockPath)); if (lock.schema !== 1) throw new Error('Unsupported asset lock')
  const stateFile = inside(root, 'tools/.tmp/asset-state.json'), state = existsSync(stateFile) ? await readJson(stateFile) : {}
  for (const [kind, bundle] of Object.entries(lock.bundles)) {
    if (!groups[kind] || !/^[a-f0-9]{64}$/.test(bundle.sha256) || !/^[a-f0-9]{64}$/.test(bundle.treeSha256) || !Number.isSafeInteger(bundle.files) || bundle.files < 1 || !/^(game|ratings)-[a-f0-9]{20}\.ndjson\.gz$/.test(bundle.file)) throw new Error('Invalid asset lock: ' + kind)
    for (const input of sourceInputs[kind]) {
      if (bundle.inputs?.[input] && sha(await readFile(inside(root, input))) !== bundle.inputs[input]) throw new Error('Resource bundle does not match ' + input + '; regenerate this group before publishing')
    }
    if (!force && state[kind] === bundle.sha256 && groups[kind].every(local => existsSync(inside(root, local))) &&
      (await Promise.all(groups[kind].map(local => countFiles(root, local)))).reduce((sum,n) => sum+n,0) === bundle.files) continue
    const cache = inside(root, `tools/.tmp/asset-cache/${bundle.sha256}.ndjson.gz`); await mkdir(path.dirname(cache), { recursive: true })
    if (!existsSync(cache) || sha(await readFile(cache)) !== bundle.sha256) {
      if (!bundle.url || !bundle.url.startsWith('https://github.com/iyuangang/dove-wiki/releases/download/')) throw new Error('Resource bundle is local only. Run npm run assets:publish before pushing this manifest: ' + kind)
      console.log('[assets] Downloading ' + bundle.file)
      await downloadBundle(bundle, cache)
    }
    await unpackGroup(root, kind, bundle, cache); state[kind] = bundle.sha256; await saveJson(stateFile, state)
    console.log(`[assets] Restored ${kind}: ${bundle.files} files`)
  }
}
