import { describe, expect, it } from 'vitest'
import { heroes, doveData } from './data'
import { snapshotManifest } from './data'
const heroReview = snapshotManifest.reviews.heroes

const hero = (id: string) => heroes.find((h) => h.id === id)!

describe('英雄详情数据回归', () => {
  it('当前审阅提交的英雄机制全部完成复核，并保留浚湃低血量被动', () => {
    const snapshotCommit = doveData.metadata.heroSnapshot?.commitHash || doveData.metadata.commitHash
    if (snapshotCommit !== heroReview.gameCommit) return
    expect(heroes.flatMap((h) => h.details.pending)).toEqual([])
    expect(hero('hero_naga').details.items.find((item) => item.id === 'naga-fight')?.summary).toContain('80%')
  })
  it('完整英雄名单保留来源可查的基础数据和实际审阅版本', () => {
    expect(heroes).toHaveLength(doveData.summary.heroCount)
    expect(new Set(heroes.map((h) => h.id)).size).toBe(heroes.length)
    expect(hero('hero_naga').name).toBe('浚湃')
    for (const h of heroes) {
      expect(h.details.reviewedVersion).toBe(heroReview.version)
      expect(h.details.movement.baseSpeed, h.id).toBeGreaterThan(0)
      expect(h.details.items.length + h.details.pending.length, h.id).toBeGreaterThan(0)
      expect(h.details.sources.length, h.id).toBeGreaterThan(0)
      expect(h.details.sources.every((s) => s.line != null && s.line > 0), h.id).toBe(true)
      for (const item of h.details.items) {
        expect(item.sources.length, `${h.id}:${item.id}`).toBeGreaterThan(0)
        expect(item.sources.every((s) => s.line != null && s.line > 0 && s.file in heroReview.files), `${h.id}:${item.id}`).toBe(true)
        expect(JSON.stringify(item)).not.toMatch(/undefined|NaN|Infinity|—/)
      }
    }
  })
  it('待核实的移动机制撤下分类标签，且不与已发布条目重复', () => {
    for (const h of heroes) {
      expect(new Set(h.details.pending).size, h.id).toBe(h.details.pending.length)
      expect(new Set(h.details.items.map((item) => item.id)).size, h.id).toBe(h.details.items.length)
      for (const title of h.details.pending) {
        expect(title.trim(), h.id).not.toBe('')
        expect(h.details.items.map((item) => item.title), h.id).not.toContain(title)
      }
      if (h.details.pending.length) {
        expect(h.details.movement.label, h.id).toBe('移动机制待核实')
        expect(h.details.movement.tags, h.id).toEqual([])
      } else {
        expect(h.details.movement.label, h.id).not.toBe('移动机制待核实')
        expect(h.details.movement.tags.length, h.id).toBeGreaterThan(0)
      }
    }
  })
  it('专属机制保留已发布或待复核记录，不会在升级后静默丢失', () => {
    const expected = [
      ['hero_dragon', '常驻飞行单位'], ['hero_monkey_god', '腾云移动'],
      ['hero_durax', '棱晶移动'], ['hero_raelyn', '按横向距离跳跃'],
      ['hero_10yr', '远距离传送'], ['hero_priest', '光翼传送'],
      ['hero_crab', '技能潜地'], ['hero_venom', '黏液移动'],
      ['hero_tramin', '长距离火箭跳'], ['hero_xin', '调动即传送'],
      ['hero_bolverk', '残血缩短攻击冷却'], ['hero_wilbur', '引擎影响飞行速度'],
      ['hero_oni', '失血增伤与减伤'], ['hero_dragon_gem', '移动触发蓄能'],
    ] as const
    for (const [id, title] of expected) {
      const details = hero(id).details
      expect([...details.items.map((item) => item.title), ...details.pending], id).toContain(title)
    }
  })
  it('原始攻击与恢复参数在审阅失效后仍保持有效且有明确类型', () => {
    for (const h of heroes) {
      expect(h.details.respawnSeconds, h.id).toBeGreaterThan(0)
      expect(h.details.regenInterval, h.id).toBeGreaterThanOrEqual(0)
      expect(h.details.regenHitDelay, h.id).toBeGreaterThanOrEqual(0)
      for (const attack of h.details.attacks) {
        expect(['近战', '远程']).toContain(attack.kind)
        expect(typeof attack.disabled).toBe('boolean')
        for (const value of [attack.cooldown, attack.range, attack.minRange]) {
          expect(value === null || (Number.isFinite(value) && value >= 0), h.id).toBe(true)
        }
      }
    }
  })
})
