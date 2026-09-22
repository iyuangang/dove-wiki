import { describe, it, expect } from 'vitest'
import { buildTowerMechanics, sourceHash } from './tower-mechanics.mjs'
import { damageRule, mechanicCatalog } from './tower-mechanics-catalog.mjs'

describe('机制的来源验证', () => {
  it('换行符差异不触发误报，实际源码修改会改变指纹', () => {
    expect(sourceHash('a\r\nb')).toBe(sourceHash('a\nb'))
    expect(sourceHash('damage = 1')).not.toBe(sourceHash('damage = 2'))
  })
  it('失效或缺失的源码不再输出已核实结论', () => {
    const raw = { id: 'tower_shaolin' }
    const tower = { attack: { damageTypeValue: 2 } }
    const result = buildTowerMechanics(raw, tower, { version: 'test', files: new Map() })
    expect(result.items).toEqual([])
    expect(result.pending).toContain('普攻自带控制：条件与实际时长')
    expect(result.hasSpecificReview).toBe(true)
  })
  it('没有专属审查的塔保留通用规则，但不冒充完成专属审查', () => {
    const rule = damageRule(2)
    const files = new Map(rule.sources.map(([file, anchor]) => [file, {valid: true, text: `header\n${anchor}\n`}]))
    const result = buildTowerMechanics({id: 'unknown'}, {attack: {damageTypeValue: 2}}, {version:'test',files})
    expect(result.hasSpecificReview).toBe(false)
    expect(result.items[0].sources[0].line).toBe(2)
    files.get(rule.sources[0][0]).valid = false
    expect(buildTowerMechanics({id: 'unknown'}, {attack: {damageTypeValue: 2}}, {version:'test',files}).items).toEqual([])
  })
  it('伤害类型按游戏位标记及优先级选择，区分毒与魔法爆炸', () => {
    expect(damageRule(32).title).toContain('魔法爆炸')
    expect(damageRule(65536).title).toContain('中毒')
    expect(damageRule(64 | 33554432).title).toContain('枪弹')
    expect(damageRule(4 | 8192).title).toContain('魔法伤害')
    expect(damageRule(512).title).toContain('混合')
    expect(damageRule(256).title).toContain('刺击')
    expect(damageRule(null)).toBeNull()
    expect(damageRule(0)).toBeNull()
  })
  it('条目 ID 在每座塔内唯一，且每项都有源码依据', () => {
    for (const definitions of Object.values(mechanicCatalog)) {
      expect(new Set(definitions.map((item) => item.id)).size).toBe(definitions.length)
      expect(definitions.every((item) => item.sources.length > 0)).toBe(true)
    }
  })
})
