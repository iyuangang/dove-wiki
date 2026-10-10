import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { enemyValidation, snapshotHash, validateRaw, validateSnapshot } from './snapshot-validation.mjs'

const text = await readFile(new URL('../src/data/dove-data.json', import.meta.url), 'utf8')
const data = JSON.parse(text)
const manifest = JSON.parse(await readFile(new URL('../src/data/snapshot-manifest.json', import.meta.url), 'utf8'))
const contract = JSON.parse(await readFile(new URL('../src/data-contract.json', import.meta.url), 'utf8'))

describe('快照发布兼容与审阅证据', () => {
  it('当前快照、资源审阅清单和哈希一致，跨平台换行不影响校验', () => {
    expect(() => validateSnapshot(data, manifest, contract)).not.toThrow()
    expect(snapshotHash(text)).toBe(manifest.dataHash)
    expect(snapshotHash(text.replace(/\r?\n/g, '\r\n'))).toBe(manifest.dataHash)
    expect(data.enemies.every((enemy) => enemy.statsByDifficulty.every((variant) => variant.stats.hp > 0))).toBe(true)
    expect(data.enemies.at(-1).boss).toBe(true)
  })
  it('仅更新数据里的审阅版本与对应清单，不依赖站点工具的旧审阅版本', () => {
    const nextData = structuredClone(data)
    const nextManifest = structuredClone(manifest)
    nextManifest.reviews.towers.version = 'future-reviewed-version'
    nextData.towers.forEach((tower) => { tower.mechanics.reviewedVersion = 'future-reviewed-version' })
    expect(() => validateSnapshot(nextData, nextManifest, contract)).not.toThrow()
    expect(() => validateSnapshot(nextData, manifest, contract)).toThrow('审阅版本')
  })
  it('拒绝未知数据格式和无效来源上的已核实结论', () => {
    expect(() => validateSnapshot({ ...data, schemaVersion: 999 }, manifest, contract)).toThrow('不支持数据格式')
    const broken = structuredClone(manifest)
    broken.reviews.towers.invalidFiles.push(data.towers.find((tower) => tower.mechanics.items.length).mechanics.items[0].sources[0].file)
    expect(() => validateSnapshot(data, broken, contract)).toThrow('有效审阅指纹')
  })
  it('拒绝旧运行结果，缺失字段都进入可追溯清单', () => {
    expect(() => validateRaw({ metadata: { runId: 'old-run' } }, 'new-run')).toThrow('本次运行')
    const report = enemyValidation(data.enemies)
    expect(report.enemyInfoErrors).toEqual([])
    expect(report.enemyMissingStats.every((item) => item.reason && item.entryId && item.difficulty)).toBe(true)
  })
})
