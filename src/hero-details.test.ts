import { describe, expect, it } from 'vitest'
import { heroes, doveData } from './data'

const hero = (id: string) => heroes.find((h) => h.id === id)!
const facts = (id: string, item: string) => hero(id).details.items.find((i) => i.id === item)!.facts.join(' ')

describe('英雄详情数据回归', () => {
  it('78 位英雄均有来源可查的基础行为与移动说明', () => {
    expect(heroes).toHaveLength(78)
    for (const h of heroes) {
      expect(h.details.reviewedVersion).toBe(doveData.metadata.heroSnapshot?.gameVersion || doveData.metadata.gameVersion)
      expect(h.details.pending, h.id).toEqual([])
      expect(h.details.movement.baseSpeed, h.id).toBeGreaterThan(0)
      expect(h.details.items.length, h.id).toBeGreaterThan(0)
      expect(h.details.sources.every((s) => s.line != null && s.line > 0), h.id).toBe(true)
      for (const item of h.details.items) {
        expect(item.sources.every((s) => s.line != null && s.line > 0), `${h.id}:${item.id}`).toBe(true)
        expect(JSON.stringify(item)).not.toMatch(/undefined|NaN|Infinity|—/)
      }
    }
  })
  it('常驻飞行与地面英雄的特殊赶路模式分开筛选', () => {
    for (const id of ['hero_dragon', 'hero_wilbur', 'hero_phoenix']) expect(hero(id).details.movement.tags).toContain('飞行')
    for (const id of ['hero_vampiress', 'hero_margosa', 'hero_robot', 'hero_wukong', 'hero_monkey_god', 'hero_catha', 'hero_witch']) expect(hero(id).details.movement.tags).not.toContain('飞行')
    expect(facts('hero_monkey_god', 'travel-form')).toContain('300')
    expect(facts('hero_monkey_god', 'travel-form')).toContain('216')
    expect(facts('hero_durax', 'transfer')).toContain('225')
  })
  it('保留距离边界、横向判定、技能启用与形态限制', () => {
    expect(facts('hero_raelyn', 'raelyn-jump')).toContain('恰好 125 或 300 时不触发')
    expect(facts('hero_10yr', 'teleport')).toContain('距离大于 200')
    expect(facts('hero_priest', 'teleport')).toContain('Lv.1')
    expect(facts('hero_crab', 'burrow')).toContain('Lv.1')
    expect(facts('hero_venom', 'travel-form')).toContain('战斗变身')
    expect(facts('hero_tramin', 'tramin-jetpack')).toContain('0.9 秒')
    expect(facts('hero_xin', 'xin-rally')).toContain('没有最短距离阈值')
  })
  it('低血量被动和引擎速度不是名称推断', () => {
    expect(facts('hero_bolverk', 'berserker')).toContain('半血为 0.75 倍')
    expect(facts('hero_wilbur', 'engine-speed')).toContain('1.2 / 1.4 / 1.6')
    expect(hero('hero_oni').details.items.some((i) => i.id === 'oni-missing-health')).toBe(true)
    expect(hero('hero_dragon_gem').details.items.find((i) => i.id === 'travel-charge')!.summary).toContain('250')
  })
})
