import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beginSync } from './sync-transaction.mjs'

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'dove-sync-test-'))
  try { await run(root) } finally { await rm(root, { recursive: true, force: true }) }
}
async function put(root, path, content) {
  const target = join(root, path)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, content)
}

describe('同步快照事务', () => {
  it('资源替换后发生错误，恢复整份旧数据并移除新资源', async () => fixture(async (root) => {
    await put(root, 'public/enemies/old.png', 'old image')
    await put(root, 'src/data/dove-data.json', 'old data')
    const transaction = await beginSync(root)
    try {
      await put(transaction.stageRoot, 'public/enemies/new.png', 'new image')
      await put(transaction.stageRoot, 'src/data/dove-data.json', 'new data')
      await expect(transaction.promote(['public/enemies', 'src/data/dove-data.json'], (index) => { if (index === 2) throw new Error('disk error') })).rejects.toThrow('disk error')
      expect(await readFile(join(root, 'src/data/dove-data.json'), 'utf8')).toBe('old data')
      expect(await readFile(join(root, 'public/enemies/old.png'), 'utf8')).toBe('old image')
      expect(existsSync(join(root, 'public/enemies/new.png'))).toBe(false)
    } finally { await transaction.close() }
  }))
  it('新进程恢复上次中断的资源替换', async () => fixture(async (root) => {
    const tempRoot = join(root, 'tools/.tmp/sync-interrupted')
    await put(root, 'src/data/dove-data.json', 'old data')
    await put(tempRoot, 'stage/src/data/dove-data.json', 'new data')
    await mkdir(join(tempRoot, 'backup/src/data'), { recursive: true })
    await rename(join(root, 'src/data/dove-data.json'), join(tempRoot, 'backup/src/data/dove-data.json'))
    await rename(join(tempRoot, 'stage/src/data/dove-data.json'), join(root, 'src/data/dove-data.json'))
    await put(root, 'tools/.tmp/sync-transaction.json', JSON.stringify({ tempRoot, items: [{ path: 'src/data/dove-data.json', hadTarget: true }] }))
    const transaction = await beginSync(root)
    try { expect(await readFile(join(root, 'src/data/dove-data.json'), 'utf8')).toBe('old data') }
    finally { await transaction.close() }
  }))
  it('拒绝并发同步及非生成路径', async () => fixture(async (root) => {
    const transaction = await beginSync(root)
    try {
      await expect(beginSync(root)).rejects.toThrow('正在运行')
      await expect(transaction.promote(['../outside'])).rejects.toThrow('非生成路径')
    } finally { await transaction.close() }
  }))
})
