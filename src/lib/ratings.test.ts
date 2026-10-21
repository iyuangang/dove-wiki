import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import manifest from '../data/rating-manifest.json'
import { axesFor, filterRatings, radarPolygon, ratingTier, type RatingDataset } from './ratings'

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const profiles = Object.entries(manifest.profiles).map(([id, p]) => {
  const bytes = readFileSync(path.join(publicDir, p.file))
  return { id, manifest: p, bytes, data: JSON.parse(bytes.toString('utf8')) as RatingDataset }
})
describe('发布的原生强度测评', () => {
  for (const { id, manifest: p, bytes, data } of profiles) {
    it(`${id} 保留完整正式名单、独立档位与客户端校验值`, () => {
      expect(hash(bytes)).toBe(p.sha256)
      expect(data.summary.profile).toBe(id)
      expect(data.summary.coreFailed).toBe(0)
      expect(data.summary.coreTrials).toBe(id === 'standard' ? 15145 : 9087)
      expect(data.objects.filter(r => r.core)).toHaveLength(261)
      expect(data.objects.filter(r => r.group === 'hero_melee')).toHaveLength(79)
      expect(data.objects.filter(r => r.group === 'hero_ranged')).toHaveLength(79)
      expect(data.objects.filter(r => r.group === 'tower_final')).toHaveLength(91)
      expect(data.objects.filter(r => r.group === 'tower_lower')).toHaveLength(12)
      expect(data.objects.filter(r => r.group === 'tower_special')).toHaveLength(18)
    })
    it(`${id} 所有已发布分数可用固定参照复算，辅助单轴不被综合分覆盖`, () => {
      for (const row of data.objects) {
        for (const s of Object.values(row.scores)) if (s.value !== null) {
          expect(s.value).toBeCloseTo(Math.min(100, 70 * Math.sqrt(s.raw! / s.reference!)), 6)
        }
        if (row.state !== 'complete') for (const role of ['output', 'defense', 'support'] as const) {
          expect(row.ratings[role].value).toBeNull()
          expect(ratingTier(row, role)).toBe('未评测')
        }
        if (row.ratings.support.value !== null) {
          expect(row.ratings.support.value).toBeCloseTo(row.scores.support.value! * .7 + row.scores.control.value! * .3, 6)
        }
      }
      const sample = data.objects.find(r => r.id === 'hero_10yr__melee')!
      expect(sample.scores.support.value).not.toBe(sample.ratings.support.value)
    })
    it(`${id} 原始证据压缩前后 SHA-256 一致，全部 21 张天梯图可下载`, () => {
      const seen = new Set<string>()
      for (const row of data.objects) if (!seen.has(row.templateId)) {
        seen.add(row.templateId)
        const compressed = readFileSync(path.join(publicDir, row.evidence.file))
        expect(hash(compressed)).toBe(row.evidence.gzipSha256)
        expect(hash(gunzipSync(compressed))).toBe(row.evidence.sha256)
      }
      expect(seen.size).toBe(206)
      for (const group of new Set(data.objects.map(r => r.group))) for (const role of ['output', 'defense', 'support']) {
        expect(existsSync(path.join(publicDir, `rating/${id}/${group}_${role}.png`))).toBe(true)
      }
    })
  }
  it('按模式隔离搜索、正确处理失败项与零能力雷达', () => {
    const data = profiles[0]!.data
    const ranged = filterRatings(data.objects, 'hero_ranged', 'output', ' HERO_ALLERIA ')
    expect(ranged).toHaveLength(1)
    expect(ranged[0]!.id).toBe('hero_alleria__ranged')
    const failed = data.objects.find(r => r.state !== 'complete')!
    expect(radarPolygon(failed)).toBeNull()
    const zero = structuredClone(ranged[0]!)
    for (const key of axesFor(zero.kind)) zero.scores[key]!.value = 0
    expect(radarPolygon(zero)).not.toMatch(/NaN|Infinity/)
    expect(radarPolygon(zero)?.split(' ')).toHaveLength(8)
  })
})
