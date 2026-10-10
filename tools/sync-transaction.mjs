import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const generatedPaths = [
  'public/portraits', 'public/encyclopedia', 'public/skills', 'public/heroes',
  'public/enemies', 'public/technologies', 'public/damage-types',
  'src/data/dove-data.json', 'src/data/game-changelog.json', 'src/data/snapshot-manifest.json',
]

const managed = (path) => !isAbsolute(path) && !path.split(/[\\/]/).some((part) => part === '..' || part === '.') &&
  (generatedPaths.includes(path) || generatedPaths.some((directory) => directory.startsWith('public/') && path.startsWith(`${directory}/`) && path.endsWith('.png')))

async function imageFiles(root, path) {
  const directory = inside(root, path)
  if (!existsSync(directory)) return []
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const local = `${path}/${entry.name}`
    if (entry.isSymbolicLink()) throw new Error(`生成资源目录中不允许符号链接：${local}`)
    if (entry.isDirectory()) paths.push(...await imageFiles(root, local))
    else if (entry.isFile() && entry.name.endsWith('.png')) paths.push(local)
  }
  return paths
}

async function move(source, target) {
  for (let attempt = 0; ; attempt++) {
    try { await rename(source, target); return }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}

function inside(root, path) {
  const absolute = resolve(root, path)
  const local = relative(resolve(root), absolute)
  if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error(`拒绝操作工作目录之外的路径：${absolute}`)
  return absolute
}

async function recover(root, journalPath) {
  if (!existsSync(journalPath)) return
  const journal = JSON.parse(await readFile(journalPath, 'utf8'))
  const tempRoot = inside(join(root, 'tools/.tmp'), journal.tempRoot)
  if (!tempRoot.startsWith(join(resolve(root), 'tools/.tmp', 'sync-'))) throw new Error('同步恢复目录无效。')
  for (const item of [...journal.items].reverse()) {
    if (!managed(item.path)) throw new Error(`同步恢复路径无效：${item.path}`)
    const target = inside(root, item.path)
    const staged = inside(tempRoot, join('stage', item.path))
    const backup = inside(tempRoot, join('backup', item.path))
    if (existsSync(backup)) {
      await rm(target, { recursive: true, force: true })
      await mkdir(dirname(target), { recursive: true })
      await move(backup, target)
    } else if (!item.hadTarget && !existsSync(staged)) {
      await rm(target, { recursive: true, force: true })
    }
  }
  await rm(journalPath)
  await rm(tempRoot, { recursive: true, force: true })
}

export async function beginSync(root) {
  root = resolve(root)
  const tempDir = inside(root, 'tools/.tmp')
  await mkdir(tempDir, { recursive: true })
  const lockPath = join(tempDir, 'sync.lock')
  if (existsSync(lockPath)) {
    const pid = Number(await readFile(lockPath, 'utf8'))
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('同步锁损坏，请检查 tools/.tmp/sync.lock。')
    let active = true
    try { process.kill(pid, 0) } catch (error) { if (error.code === 'ESRCH') active = false }
    if (active) throw new Error(`已有同步进程正在运行（PID ${pid}）。`)
    await rm(lockPath)
  }
  const lock = await open(lockPath, 'wx')
  await lock.writeFile(String(process.pid))
  const journalPath = join(tempDir, 'sync-transaction.json')
  let tempRoot
  try {
    await recover(root, journalPath)
    tempRoot = await mkdtemp(join(tempDir, 'sync-'))
  } catch (error) {
    await lock.close()
    await rm(lockPath, { force: true })
    throw error
  }
  const stageRoot = join(tempRoot, 'stage')
  return {
    tempRoot, stageRoot,
    async promote(paths, afterPromote) {
      const items = []
      for (const path of paths) {
        if (!generatedPaths.includes(path)) throw new Error(`拒绝发布非生成路径：${path}`)
        if (!existsSync(inside(stageRoot, path))) throw new Error(`缺少待发布结果：${path}`)
        if (path.startsWith('public/')) {
          const staged = await imageFiles(stageRoot, path)
          const old = await imageFiles(root, path)
          for (const file of new Set([...staged, ...old])) {
            // Leave unchanged images in place, reducing watcher churn and disk IO.
            const hadTarget = existsSync(inside(root, file))
            const remove = !staged.includes(file)
            if (hadTarget && !remove && (await readFile(inside(root, file))).equals(await readFile(inside(stageRoot, file)))) continue
            items.push({ path: file, hadTarget, remove })
          }
        } else items.push({ path, hadTarget: existsSync(inside(root, path)), remove: false })
      }
      await writeFile(journalPath, JSON.stringify({ tempRoot, items }))
      try {
        for (const [index, item] of items.entries()) {
          const target = inside(root, item.path)
          const backup = inside(tempRoot, join('backup', item.path))
          await mkdir(dirname(backup), { recursive: true })
          await mkdir(dirname(target), { recursive: true })
          if (item.hadTarget) await move(target, backup)
          if (!item.remove) await move(inside(stageRoot, item.path), target)
          await afterPromote?.(index)
        }
        // Removing the journal commits the transaction. Backups are now disposable.
        await rm(journalPath)
      } catch (error) {
        await recover(root, journalPath)
        throw error
      }
    },
    async close() {
      // Keep the journal and backups if rollback itself failed; the next run recovers.
      if (!existsSync(journalPath)) await rm(inside(tempDir, tempRoot), { recursive: true, force: true })
      await lock.close()
      await rm(lockPath, { force: true })
    },
  }
}
