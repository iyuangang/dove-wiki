import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, rename, open, unlink, cp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveDovePaths } from './dove-paths.mjs'

export const dataPaths = ['src/data/site-index.json', 'src/data/dove-data.json', 'src/data/game-changelog.json', 'src/data/snapshot-manifest.json',
  'src/data/rating-manifest.json', 'src/data/rating-methodology.json', 'src/data/rating-contract.json', 'data/asset-lock.json']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const delay = ms => new Promise(done => setTimeout(done, ms))
const stableVersion = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function parseOptions(args) {
  const options = {}
  const flags = new Set(['dry-run', 'prepare-only', 'new-run', 'help'])
  const values = new Set(['profile', 'run-directory', 'game-dir', 'love-exe', 'methods', 'version'])
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '')
    if (Object.hasOwn(options, key)) throw new Error(`参数重复：${args[i]}`)
    if (flags.has(key)) options[key] = true
    else if (values.has(key) && args[i + 1] && !args[i + 1].startsWith('--')) options[key] = args[++i]
    else throw new Error(`不支持的参数或缺少参数值：${args[i]}`)
  }
  options.profile ||= 'standard'
  if (!['standard', 'quick'].includes(options.profile)) throw new Error('档位只能为 standard 或 quick')
  if (options.version && !stableVersion.test(options.version)) throw new Error('版本格式应为 v1.2.3')
  return options
}

export function nextVersion(tags) {
  const versions = tags.split(/\s+/).filter(s => stableVersion.test(s)).map(s => s.slice(1).split('.').map(Number))
  versions.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])
  const [major, minor, patch] = versions[0] || [1, 0, 0]
  return `v${major}.${minor}.${patch + 1}`
}

export async function command(executable, args, { cwd, capture = false, env = {} } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(executable, args, { cwd, env: { ...process.env, ...env }, windowsHide: true,
      shell: false, stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] })
    let output = '', error = ''
    child.stdout?.on('data', chunk => { output += chunk })
    child.stderr?.on('data', chunk => { error += chunk })
    child.once('error', fail)
    child.once('exit', code => code === 0 ? done(output.trimEnd()) : fail(new Error(`${executable} ${args.join(' ')} 失败（${code}）\n${error}`)))
  })
}

async function npmCli(run, root) {
  const candidates = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')]
  if (process.platform === 'win32') {
    const locations = await run('where.exe', ['npm'], { cwd: root, capture: true })
    for (const item of locations.split(/\r?\n/)) candidates.push(join(dirname(item), 'node_modules/npm/bin/npm-cli.js'))
  }
  const cli = candidates.find(file => file?.endsWith('.js') && existsSync(file))
  if (!cli) throw new Error('未找到 npm，请安装包含 npm 的 Node.js 24 或更新版本')
  return resolve(cli)
}

export async function createPlan(root, options, run = command) {
  const saveRoot = join(process.env.APPDATA || join(homedir(), 'AppData/Roaming'), 'LOVE/kingdom_rush_dove')
  let source = options['run-directory'] && resolve(options['run-directory'])
  let personal
  if (!source) {
    personal = await json(join(saveRoot, 'Meta_Rating_Center/baselines', options.profile + '.json'))
    if (personal.schema !== 1 || personal.profile !== options.profile || hash(personal.reference_json) !== personal.reference_sha256) throw new Error('个人基准校验失败，请重新启用完整测评批次')
    source = resolve(personal.source_directory)
  }
  const bytes = await readFile(join(source, 'native_reference.json'))
  if (personal && hash(bytes) !== personal.reference_sha256) throw new Error('已启用基准与原始批次不同，请保留原始结果目录')
  const summary = JSON.parse(bytes).summary
  if (!summary.core_complete || (summary.core_error_trials ?? summary.core_failed_trials) !== 0) throw new Error('本批正式样本未完整成功，停止发布')
  if (summary.seconds !== (options.profile === 'standard' ? 60 : 30) || summary.repeats !== (options.profile === 'standard' ? 5 : 3)) throw new Error('批次时长或重复次数与所选档位不同')
  const paths = resolveDovePaths({ gameDir: options['game-dir'], loveExe: options['love-exe'],
    defaultGameDirs: [join(process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), '王国保卫战Dove版')] })
  const pluginMethods = join(saveRoot, 'plugins/Meta_Rating_Center/测评标准与局限.md')
  const methods = resolve(options.methods || (existsSync(pluginMethods) ? pluginMethods : join(source, '测评标准与局限.md')))
  const methodsSha = hash(await readFile(methods))
  const git = args => run('git', args, { cwd: root, capture: true })
  const version = options.version || nextVersion(await git(['tag', '--list', 'v*']))
  if ((await git(['tag', '--list', version])).trim()) throw new Error(`版本 ${version} 已存在，请使用未发布的版本号`)
  const released = JSON.parse(await run('gh', ['release', 'view', '--json', 'tagName'], { cwd: root, capture: true })).tagName
  if (!stableVersion.test(released)) throw new Error('无法确认最新正式版本，请先检查仓库 Release')
  const manifest = JSON.parse(await git(['show', `${released}:src/data/rating-manifest.json`]))
  const game = JSON.parse(await git(['show', `${released}:src/data/dove-data.json`]))
  const methodology = JSON.parse(await git(['show', `${released}:src/data/rating-methodology.json`]))
  const gameCommit = (await readFile(join(paths.gameDir, 'current_version_commit_hash.txt'), 'utf8')).trim()
  const contractSource = join(saveRoot, 'plugins/Meta_Rating_Center/data/rating_contract.json')
  const contractSha = existsSync(contractSource) ? hash(await readFile(contractSource)) : null
  const releasedContract = contractSha ? await git(['show', `${released}:src/data/rating-contract.json`]).catch(() => null) : null
  return { profile: options.profile, source, sourceSha: hash(bytes), measuredGameVersion: summary.game_version, runId: summary.run_id,
    ...paths, gameCommit, methods, methodsSha, version, contractSource: contractSha ? contractSource : null, contractSha,
    unchanged: manifest.profiles[options.profile]?.sourceSummarySha256 === hash(bytes) && game.metadata.commitHash === gameCommit && methodology.sha256 === methodsSha && (!contractSha || releasedContract !== null && hash(releasedContract.trimEnd()) === hash((await readFile(contractSource, 'utf8')).trimEnd())) }
}

export function assertDataPaths(files) {
  if (!files.length || files.some(file => !dataPaths.includes(file))) throw new Error('同步产生了非生成文件或没有可发布数据，停止提交')
}

export async function verifyPublished(site, manifest, version, fetcher = fetch) {
  const base = site.endsWith('/') ? site : site + '/'
  const html = await fetcher(`${base}?release=${encodeURIComponent(version)}`, { cache: 'no-cache' })
  if (!html.ok) throw new Error(`线上首页 HTTP ${html.status}`)
  const entry = /<script\b[^>]*\bsrc="([^"]+)"/.exec(await html.text())?.[1]
  if (!entry) throw new Error('线上首页缺少脚本入口')
  const js = await fetcher(new URL(entry, base), { cache: 'no-cache' })
  if (!js.ok || !(await js.text()).includes(version)) throw new Error('线上站点版本尚未更新')
  for (const p of Object.values(manifest.profiles)) {
    const response = await fetcher(new URL(`${p.file}?sha256=${p.sha256}`, base), { cache: 'no-cache' })
    if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== p.sha256) throw new Error(`线上 ${p.profile} 结果摘要不一致`)
  }
}

export async function publish(state, { root, run = command, save, poll = delay, log = console.log }) {
  const git = (args, cwd = state.worktree) => run('git', args, { cwd, capture: true })
  const gh = args => run('gh', args, { cwd: root, capture: true })
  const ghJson = async args => JSON.parse(await gh(args))
  const setPhase = async phase => { state.phase = phase; await save(state) }
  const node = (file, args = [], env = {}) => run(process.execPath, [join(state.worktree, file), ...args], { cwd: state.worktree, env })
  if (hash(await readFile(join(state.source, 'native_reference.json'))) !== state.sourceSha || hash(await readFile(state.methods)) !== state.methodsSha) throw new Error('输入批次或说明在本次发布期间改变，请使用 --new-run 开始新的发布')
  if (state.contractSha && hash(await readFile(state.contractSource)) !== state.contractSha) throw new Error('评分定义在发布期间改变，请使用 --new-run 开始新的发布')
  if (state.phase === 'created') {
    log('1/6 在独立目录同步测评和游戏，执行本地检查……')
    if (!existsSync(join(state.worktree, '.git'))) {
      await git(['worktree', 'add', '-b', state.branch, state.worktree, 'origin/dev'], root)
    }
    if (!state.baseSha) {
      await git(['merge', '--no-edit', 'origin/main'])
      state.baseSha = await git(['rev-parse', 'HEAD']); await save(state)
    }
    await run(process.execPath, [state.npmCli, 'ci'], { cwd: state.worktree })
    const cache = join(root, 'tools/.tmp/asset-cache')
    if (existsSync(cache)) await cp(cache, join(state.worktree, 'tools/.tmp/asset-cache'), { recursive: true })
    await node('tools/import-ratings.mjs', ['--' + state.profile, state.source, '--methods', state.methods])
    await node('tools/sync-dove.mjs', ['--game-dir', state.gameDir, '--love-exe', state.loveExe])
    await node('tools/assets.mjs', ['pack', 'game'])
    // Build-only settings must not leak into raw-asset unit tests.
    await node('tools/check-snapshot.mjs', [], { VITE_BASE_PATH: '' })
    await run(process.execPath, [state.npmCli, 'test'], { cwd: state.worktree, env: { VITE_BASE_PATH: '' } })
    await run(process.execPath, [state.npmCli, 'run', 'build'], { cwd: state.worktree, env: { VITE_APP_VERSION: state.version, VITE_BASE_PATH: '/dove-wiki/' } })
    await setPhase('prepared')
  }
  if (state.prepareOnly && state.phase === 'prepared') { log(`本地检查完成，尚未上传或发布。再次执行原命令（去掉 --prepare-only）即可继续。\n${state.worktree}`); return }
  if (state.phase === 'prepared') {
    log('2/6 上传校验固定的资源包，仅提交生成数据和清单……')
    const beforeUpload = (await git(['status', '--porcelain', '--untracked-files=all'])).split(/\r?\n/).filter(Boolean).map(line => line.slice(3))
    if (beforeUpload.length) assertDataPaths(beforeUpload)
    await node('tools/assets.mjs', ['publish'])
    const dirty = (await git(['status', '--porcelain', '--untracked-files=all'])).split(/\r?\n/).filter(Boolean).map(line => line.slice(3))
    if (dirty.length) {
      assertDataPaths(dirty)
      await git(['add', '--', ...dataPaths])
      await git(['commit', '-m', `chore: sync ${state.profile} ratings and Dove data`])
    }
    assertDataPaths((await git(['diff', '--name-only', state.baseSha, 'HEAD'])).split(/\r?\n/).filter(Boolean))
    state.headSha = await git(['rev-parse', 'HEAD'])
    await git(['push', '-u', 'origin', state.branch])
    await setPhase('pushed')
  }
  if (state.phase === 'pushed') {
    const existing = await ghJson(['pr', 'list', '--head', state.branch, '--base', 'dev', '--state', 'all', '--json', 'number,url'])
    if (!existing.length) {
      const body = join(dirname(state.worktree), 'pull-request.md')
      await writeFile(body, `同步 ${state.runId} 的 ${state.profile} 测评与当前游戏数据。正式样本完整性、资源引用、单元测试和生产构建已通过。图片与证据由校验固定的独立资源包托管。\n`)
      await gh(['pr', 'create', '--base', 'dev', '--head', state.branch, '--title', `同步 ${state.measuredGameVersion} ${state.profile} 天梯与游戏数据`, '--body-file', body])
    }
    const pr = (await ghJson(['pr', 'list', '--head', state.branch, '--base', 'dev', '--state', 'all', '--json', 'number,url']))[0]
    if (!pr) throw new Error('未能确认同步 PR，请检查 GitHub 后重试')
    state.pr = pr.number; state.prUrl = pr.url
    await setPhase('pr')
  }
  if (state.phase === 'pr') {
    log(`3/6 等待 PR 的 CI，通过后合并：${state.prUrl}`)
    let ready = false
    for (let attempt = 0; attempt < 160; attempt++) {
      const pr = await ghJson(['pr', 'view', String(state.pr), '--json', 'state,headRefOid,statusCheckRollup'])
      if (pr.headRefOid !== state.headSha) throw new Error('PR 被其他提交更新，停止自动合并')
      if (pr.state === 'MERGED') { ready = true; break }
      if (pr.state !== 'OPEN') throw new Error('同步 PR 已关闭，停止发布')
      const checks = pr.statusCheckRollup || []
      if (checks.some(c => ['FAILURE', 'ERROR'].includes(c.state) || ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes((c.conclusion || '').toUpperCase()))) throw new Error(`CI 未通过，请检查 ${state.prUrl}；修复后重新运行`)
      if (checks.length && checks.every(c => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes((c.conclusion || c.state || '').toUpperCase()))) {
        await gh(['pr', 'merge', String(state.pr), '--merge', '--match-head-commit', state.headSha]); ready = true; break
      }
      await poll(15000)
    }
    if (!ready) throw new Error('CI 等待超时，重新执行原命令可继续等待')
    await setPhase('merged')
  }
  if (state.phase === 'merged') {
    log('4/6 准备网站版本；只发布生成数据，不携带 dev 中未发布的功能……')
    await git(['fetch', 'origin', '--tags'], root)
    await git(['merge-base', '--is-ancestor', 'origin/main', 'origin/dev'], root)
    state.dispatchAt ||= new Date().toISOString(); await save(state)
    const find = async () => (await ghJson(['run', 'list', '--workflow', 'publish-game-data.yml', '--limit', '100', '--json', 'databaseId,displayTitle,createdAt']))
      .find(r => r.displayTitle === `Publish game data ${state.version}` && Date.parse(r.createdAt) >= Math.floor(Date.parse(state.dispatchAt) / 1000) * 1000)
    let workflow = await find()
    if (!workflow) {
      if ((await git(['tag', '--list', state.version], root)).trim()) throw new Error(`版本 ${state.version} 已被使用，停止覆盖，请使用 --new-run --version 新版本号`)
      await gh(['workflow', 'run', 'publish-game-data.yml', '--ref', 'main', '-f', `version=${state.version}`])
      for (let attempt = 0; attempt < 12 && !workflow; attempt++) { await poll(5000); workflow = await find() }
    }
    if (!workflow) throw new Error('发布已请求，但尚未查到工作流；请重新执行原命令继续确认')
    state.dataRun = workflow.databaseId; await setPhase('dispatched')
  }
  const waitRun = async id => {
    for (let attempt = 0; attempt < 160; attempt++) {
      const result = await ghJson(['run', 'view', String(id), '--json', 'status,conclusion,url'])
      if (result.status === 'completed') {
        if (result.conclusion !== 'success') throw new Error(`工作流未成功：${result.url}\n在 GitHub 修复并重新运行失败任务后，再执行原命令继续。`)
        return
      }
      await poll(15000)
    }
    throw new Error('工作流仍在运行；重新执行原命令可继续等待')
  }
  if (state.phase === 'dispatched') {
    await waitRun(state.dataRun)
    let release
    for (let attempt = 0; attempt < 24 && !release; attempt++) {
      release = (await ghJson(['run', 'list', '--workflow', 'release.yml', '--branch', state.version, '--limit', '5', '--json', 'databaseId']))[0]
      if (!release) await poll(5000)
    }
    if (!release) throw new Error('未查到部署任务，请检查 GitHub Actions 后重新运行')
    state.releaseRun = release.databaseId; await setPhase('deploying')
  }
  if (state.phase === 'deploying') {
    log('5/6 等待 GitHub Release 与 Pages 部署完成……')
    await waitRun(state.releaseRun)
    const repo = await ghJson(['repo', 'view', '--json', 'nameWithOwner'])
    state.site = (await gh(['api', `repos/${repo.nameWithOwner}/pages`, '--jq', '.html_url'])).trim()
    await setPhase('verifying')
  }
  if (state.phase === 'verifying') {
    log('6/6 核对线上站点版本与两档结果文件摘要……')
    const manifest = await json(join(state.worktree, 'src/data/rating-manifest.json'))
    for (let attempt = 0; ; attempt++) {
      try { await verifyPublished(state.site, manifest, state.version); break }
      catch (error) { if (attempt >= 7) throw error; await poll(15000) }
    }
    await setPhase('complete')
  }
  log(`发布成功：${state.version}\n${state.site}#/tierlist\nPR：${state.prUrl}`)
}

export async function main(args = process.argv.slice(2), root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const options = parseOptions(args)
  if (options.help) {
    console.log('用法：Update-And-Publish.cmd [--run-directory "完整测评目录"] [--profile standard|quick] [--game-dir "游戏目录"] [--version v1.2.3]\n默认读取已启用的标准基准，自动更新游戏、检查、提交 PR、等待 CI 并发布。\n--dry-run 只显示来源与计划；--prepare-only 仅本地同步与检查；--new-run 保留旧任务并新建发布。失败后原命令重试可续跑。')
    return
  }
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('请安装 Node.js 24 或更新版本')
  const run = command
  const git = args => run('git', args, { cwd: root, capture: true })
  const directory = join(root, 'tools/.tmp/publish-update')
  await mkdir(directory, { recursive: true })
  const lockPath = join(directory, 'running.lock')
  if (existsSync(lockPath)) {
    const prior = await json(lockPath)
    try { process.kill(prior.pid, 0); throw new Error(`另一个同步任务正在运行（PID ${prior.pid}）`) }
    catch (error) { if (error.code !== 'ESRCH') throw error; await unlink(lockPath) }
  }
  const lock = await open(lockPath, 'wx')
  await lock.writeFile(JSON.stringify({ pid: process.pid }))
  try {
    const statePath = join(directory, 'state.json')
    const save = async state => { await writeFile(statePath + '.pending', JSON.stringify(state, null, 2)); await rename(statePath + '.pending', statePath) }
    let state = existsSync(statePath) ? await json(statePath) : null
    await run('gh', ['auth', 'status'], { cwd: root, capture: true })
    if (options['new-run'] || !state || state.phase === 'complete') {
      if (!options['dry-run'] && (await git(['status', '--porcelain'])).trim()) throw new Error('仓库有未提交的修改，请先提交或自行保存；脚本不会重置或暂存你的修改')
      await git(['fetch', 'origin', '--prune', '--tags'])
      const plan = await createPlan(root, options, run)
      console.log(`测评：${plan.profile} / ${plan.runId}\n来源：${plan.source}\n游戏：${plan.gameDir}\n网站版本：${plan.version}`)
      if (plan.unchanged) { console.log('这批测评、游戏提交和测评说明已同步，无需重复发布。'); return }
      if (options['dry-run']) { console.log('计划：独立目录同步 → 本地检查 → 上传资源 → PR 到 dev → 等待 CI → 数据发布 → 验证线上结果。未修改或发布任何数据。'); return }
      if (state) await writeFile(join(directory, `previous-${state.id}.json`), JSON.stringify(state, null, 2))
      const id = new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + randomUUID().slice(0, 6)
      state = { ...plan, id, branch: `feature/sync-site-data-${id}`, worktree: join(directory, id, 'worktree'),
        phase: 'created', npmCli: await npmCli(run, root) }
      await save(state)
    } else {
      console.log(`继续上次发布：${state.version} / ${state.phase}`)
      for (const [arg, key] of [['profile', 'profile'], ['version', 'version'], ['run-directory', 'source'], ['methods', 'methods'], ['love-exe', 'loveExe']]) {
        if (args.includes('--' + arg) && (['run-directory', 'methods', 'love-exe'].includes(arg) ? resolve(options[arg]) : options[arg]) !== state[key]) throw new Error('参数与待续跑任务不同；使用原命令续跑，或加 --new-run 保留旧任务并创建新发布')
      }
      if (options['game-dir'] && resolveDovePaths({ gameDir: options['game-dir'], loveExe: state.loveExe }).gameDir !== state.gameDir) throw new Error('游戏目录与待续跑任务不同，请使用 --new-run')
      if (options['dry-run']) { console.log(JSON.stringify(state, null, 2)); return }
    }
    state.prepareOnly = Boolean(options['prepare-only'])
    await publish(state, { root, run, save })
  } finally { await lock.close(); await unlink(lockPath) }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`\n发布停止：${error.message}\n进度与独立工作目录保存在 tools/.tmp/publish-update；解决提示后重新执行原命令可继续。`); process.exitCode = 1 })
}
