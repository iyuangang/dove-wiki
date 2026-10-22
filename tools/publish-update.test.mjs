import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { assertDataPaths, command, createPlan, dataPaths, nextVersion, parseOptions, publish, verifyPublished } from './publish-update.mjs'

const temporary = []
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
afterEach(async () => { vi.unstubAllGlobals(); for (const path of temporary.splice(0)) {
  if (!path.startsWith(join(tmpdir(), 'wiki-publish-'))) throw new Error('Unsafe test cleanup path')
  await rm(path, { recursive: true, force: true })
} })

async function fixture(phase = 'prepared') {
  const root = await mkdtemp(join(tmpdir(), 'wiki-publish-')); temporary.push(root)
  const worktree = join(root, 'isolated worktree'), source = join(root, 'source & batch'), methods = join(root, 'methods.md')
  await mkdir(join(worktree, 'src/data'), { recursive: true }); await mkdir(source)
  await writeFile(join(worktree, '.git'), 'fixture'); await writeFile(methods, 'measurement method')
  await writeFile(join(source, 'native_reference.json'), JSON.stringify({ summary: { core_complete: true, core_failed_trials: 0, seconds: 60, repeats: 5, game_version: '2.0.9.9', run_id: 'sample-run' } }))
  const bodies = { '/wiki/rating/standard/results.json': '{"standard":"result"}', '/wiki/rating/quick/results.json': '{"quick":"result"}' }
  const manifest = { profiles: Object.fromEntries(['standard', 'quick'].map(profile => [profile, { profile, file: `rating/${profile}/results.json`, sha256: sha(bodies[`/wiki/rating/${profile}/results.json`]) }])) }
  await writeFile(join(worktree, 'src/data/rating-manifest.json'), JSON.stringify(manifest))
  const state = { phase, id: 'test', version: 'v1.7.4', profile: 'standard', branch: 'feature/sample', worktree, source, methods,
    sourceSha: sha(await readFile(join(source, 'native_reference.json'))), methodsSha: sha(await readFile(methods)),
    baseSha: 'base', headSha: 'verified-head', pr: 17, prUrl: 'https://github.com/owner/wiki/pull/17', npmCli: 'npm-cli.js',
    gameDir: 'game dir', loveExe: 'love.exe', measuredGameVersion: '2.0.9.9', runId: 'sample-run' }
  const flags = { prExists: phase !== 'pushed', merged: false, dispatched: false, uploadFails: false, ciFails: false, alteredHead: false, unrelatedFile: false, runFails: false }
  const calls = []
  const run = vi.fn(async (exe, args, options) => {
    calls.push({ exe, args, options })
    if (exe === 'git') {
      if (args[0] === 'status') return flags.unrelatedFile ? ' M src/App.vue' : ' M src/data/dove-data.json'
      if (args[0] === 'diff') return dataPaths[0]
      if (args[0] === 'rev-parse') return 'verified-head'
      return ''
    }
    if (exe === process.execPath && args.some(a => a.endsWith('assets.mjs')) && args.includes('publish') && flags.uploadFails) { flags.uploadFails = false; throw new Error('upload interrupted') }
    if (exe !== 'gh') return ''
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(flags.prExists ? [{ number: 17, url: state.prUrl }] : [])
    if (args[0] === 'pr' && args[1] === 'create') { flags.prExists = true; return state.prUrl }
    if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ state: flags.merged ? 'MERGED' : 'OPEN', headRefOid: flags.alteredHead ? 'other-head' : state.headSha,
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: flags.ciFails ? 'FAILURE' : 'SUCCESS' }] })
    if (args[0] === 'pr' && args[1] === 'merge') { flags.merged = true; return '' }
    if (args[0] === 'workflow') { flags.dispatched = true; return 'https://github.com/owner/wiki/actions/runs/123' }
    if (args[0] === 'run' && args[1] === 'list') {
      if (args.includes('release.yml')) return JSON.stringify([{ databaseId: 456 }])
      return JSON.stringify(flags.dispatched ? [{ databaseId: 123, displayTitle: `Publish game data ${state.version}`, createdAt: new Date().toISOString() }] : [])
    }
    if (args[0] === 'run' && args[1] === 'view') return JSON.stringify({ status: 'completed', conclusion: flags.runFails ? 'failure' : 'success', url: 'https://github.com/owner/wiki/actions/runs/123' })
    if (args[0] === 'repo') return JSON.stringify({ nameWithOwner: 'owner/wiki' })
    if (args[0] === 'api') return 'https://owner.github.io/wiki/'
    throw new Error(`Unexpected fake command: ${exe} ${args}`)
  })
  const fetcher = vi.fn(async url => {
    const path = new URL(url).pathname
    return new Response(path === '/wiki/' ? '<script type="module" src="/wiki/assets/index.js"></script>' : path === '/wiki/assets/index.js' ? `site version ${state.version}` : bodies[path], { status: bodies[path] || ['/wiki/', '/wiki/assets/index.js'].includes(path) ? 200 : 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  const save = vi.fn(async () => {})
  const context = { root, run, save, poll: async () => {}, log: () => {} }
  return { root, state, flags, calls, run, context, manifest, fetcher }
}

describe('一键发布命令与版本', () => {
  it('自动增加稳定补丁版本，不把资源包或预发布当正式版本', () => {
    expect(nextVersion('data-assets\nv1.7.3\nv1.9.8-beta\nv1.6.99\nv1.7.2')).toBe('v1.7.4')
    expect(nextVersion('v9.2.7\nv10.0.1')).toBe('v10.0.2')
  })
  it('拒绝不支持的档位、重复或错误的版本输入', () => {
    expect(parseOptions([]).profile).toBe('standard')
    expect(parseOptions(['--run-directory', 'C:\\a & b', '--prepare-only'])['run-directory']).toBe('C:\\a & b')
    expect(() => parseOptions(['--profile', 'long'])).toThrow()
    expect(() => parseOptions(['--version', 'data-assets'])).toThrow()
    expect(() => parseOptions(['--version'])).toThrow()
    expect(() => parseOptions(['--profile', 'standard', '--profile', 'quick'])).toThrow('重复')
  })
  it('用参数数组运行命令，保留含空格和元字符的路径及 porcelain 首列', async () => {
    expect(await command(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', ' M src/a & b.json\n'], { capture: true })).toBe(' M src/a & b.json')
  })
  it('只允许六个生成数据文件，拒绝代码和 public 图片进入提交', () => {
    expect(() => assertDataPaths(dataPaths)).not.toThrow()
    expect(() => assertDataPaths(['src/App.vue'])).toThrow()
    expect(() => assertDataPaths(['public/rating/results.json'])).toThrow()
    expect(() => assertDataPaths([])).toThrow()
  })
})

describe('独立目录发布与恢复', () => {
  it('完整执行上传、PR、CI、合并、数据发布、部署和线上摘要验证', async () => {
    const f = await fixture('pushed'); f.flags.prExists = false
    await publish(f.state, f.context)
    expect(f.state.phase).toBe('complete')
    expect(f.flags.merged).toBe(true)
    expect(f.calls.filter(c => c.exe === 'gh' && c.args[0] === 'pr' && c.args[1] === 'create')).toHaveLength(1)
    expect(f.calls.find(c => c.args[0] === 'workflow').args).toContain('version=v1.7.4')
    expect(f.fetcher).toHaveBeenCalledTimes(4)
  })
  it('prepare-only 不上传、不创建 PR，测试与构建的环境变量分开', async () => {
    const f = await fixture('created'); f.state.prepareOnly = true
    await publish(f.state, f.context)
    expect(f.state.phase).toBe('prepared')
    expect(f.calls.some(c => c.exe === 'gh')).toBe(false)
    expect(f.calls.some(c => c.args.includes('publish'))).toBe(false)
    expect(f.calls.find(c => c.args.includes('test')).options.env.VITE_BASE_PATH).toBe('')
    expect(f.calls.find(c => c.args.includes('build')).options.env.VITE_BASE_PATH).toBe('/dove-wiki/')
    expect(f.calls.find(c => c.args.some(a => a.endsWith('import-ratings.mjs'))).args).toContain(f.state.source)
  })
  it('上传中断后保留阶段，重试不会重新同步、重测或重复建 PR', async () => {
    const f = await fixture(); f.flags.uploadFails = true
    await expect(publish(f.state, f.context)).rejects.toThrow('upload interrupted')
    expect(f.state.phase).toBe('prepared')
    await publish(f.state, f.context)
    expect(f.state.phase).toBe('complete')
    expect(f.calls.some(c => c.args.some(a => a.endsWith('import-ratings.mjs')))).toBe(false)
    expect(f.calls.filter(c => c.args[0] === 'commit')).toHaveLength(1)
  })
  it('复用已合并的 PR 与已启动的版本任务，不再次合并或派发', async () => {
    const f = await fixture('pr'); f.flags.merged = true; f.flags.dispatched = true
    await publish(f.state, f.context)
    expect(f.state.phase).toBe('complete')
    expect(f.calls.some(c => c.args[0] === 'workflow' || c.args[1] === 'merge')).toBe(false)
  })
  it.each(['ciFails', 'alteredHead'])('%s 时不自动合并或发布', async flag => {
    const f = await fixture('pr'); f.flags[flag] = true
    await expect(publish(f.state, f.context)).rejects.toThrow()
    expect(f.state.phase).toBe('pr')
    expect(f.flags.merged).toBe(false)
    expect(f.flags.dispatched).toBe(false)
  })
  it('检测到工作目录里的其他文件时，在上传与提交前停止', async () => {
    const f = await fixture(); f.flags.unrelatedFile = true
    await expect(publish(f.state, f.context)).rejects.toThrow('非生成文件')
    expect(f.calls.some(c => c.args.includes('publish') || c.args[0] === 'commit')).toBe(false)
  })
  it('输入批次发生变化时，停止续跑且不执行外部命令', async () => {
    const f = await fixture()
    await writeFile(join(f.state.source, 'native_reference.json'), '{}')
    await expect(publish(f.state, f.context)).rejects.toThrow('输入批次')
    expect(f.run).not.toHaveBeenCalled()
  })
  it('部署失败不能标记发布成功', async () => {
    const f = await fixture('deploying'); f.state.releaseRun = 456; f.flags.runFails = true
    await expect(publish(f.state, f.context)).rejects.toThrow('工作流未成功')
    expect(f.state.phase).toBe('deploying')
  })
  it('线上另一档文件摘要错误时仍拒绝成功，不能只看部署状态', async () => {
    const f = await fixture()
    f.manifest.profiles.quick.sha256 = '0'.repeat(64)
    await expect(verifyPublished('https://owner.github.io/wiki/', f.manifest, f.state.version, f.fetcher)).rejects.toThrow('quick')
  })
  it('从已发布版本判断有无变化，不能把尚未上线的 dev 数据当成已发布', async () => {
    const f = await fixture()
    const game = join(f.root, 'game directory'); await mkdir(join(game, 'kr1'), { recursive: true })
    await writeFile(join(game, 'kr1/game_settings.lua'), ''); await writeFile(join(game, 'love.exe'), '')
    await writeFile(join(game, 'current_version_commit_hash.txt'), 'current-game')
    const options = parseOptions(['--run-directory', f.state.source, '--methods', f.state.methods, '--game-dir', game])
    const seen = []
    const run = async (exe, args) => {
      seen.push(args)
      if (exe === 'gh') return JSON.stringify({ tagName: 'v1.7.3' })
      if (args[0] === 'tag') return args[2] === 'v*' ? 'v1.7.3' : ''
      const p = args[1]
      if (p.endsWith('rating-manifest.json')) return JSON.stringify({ profiles: { standard: { sourceSummarySha256: 'old-published-result' } } })
      if (p.endsWith('rating-methodology.json')) return JSON.stringify({ sha256: f.state.methodsSha })
      return JSON.stringify({ metadata: { commitHash: 'current-game' } })
    }
    const plan = await createPlan(f.root, options, run)
    expect(plan.unchanged).toBe(false)
    expect(seen.filter(args => args[0] === 'show').every(args => args[1].startsWith('v1.7.3:'))).toBe(true)
  })
})
