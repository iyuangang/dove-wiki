import { describe, expect, it } from 'vitest'
import { doveData, towerById } from '../data'
import { buildSimulationTechnologies, calculationRules, purgeDamageBonus } from './calculation-rules'
import { calculateBuffs } from './calculator'

describe('已审阅计算规则与叠加边界', () => {
  it('肃清立场遵守人数上下限，异常输入保持有限数值', () => {
    expect(purgeDamageBonus(-10)).toBeCloseTo(0.14)
    expect(purgeDamageBonus(0)).toBeCloseTo(0.14)
    expect(purgeDamageBonus(30)).toBeCloseTo(0.44)
    expect(purgeDamageBonus(100)).toBeCloseTo(0.44)
    expect(purgeDamageBonus(Number.NaN)).toBeCloseTo(0.14)
  })
  it('肃清立场与塔辅助增伤相加，避免重复乘算', () => {
    const tower = towerById.get('tower_arcane_wizard')!
    const effect = doveData.supportEffects.find((item) => item.levels.some((level) => level.damageBonus))!
    const level = effect.levels.find((item) => item.damageBonus)!
    const selection = { treeId: 4, levels: { archer: 0, barrack: 0, mage: 6, engineer: 0 }, nearbyEnemyCount: 10 }
    const plain = calculateBuffs(tower, [effect], [], doveData.technologyTrees, selection)
    const boosted = calculateBuffs(tower, [effect], [{ effectId: effect.id, level: level.level }], doveData.technologyTrees, selection)
    expect(boosted.damageBonus).toBeGreaterThan(0)
    expect(boosted.technologyDamageBonus).toBeCloseTo(0.24)
    expect(boosted.damageMin).toBeCloseTo(boosted.technologyDamageMin! * (1 + boosted.damageBonus + 0.24), 3)
    expect(boosted.damageMin! - plain.damageMin!).toBeCloseTo(boosted.technologyDamageMin! * boosted.damageBonus, 3)
  })
  it('护甲撕裂使用科技后模板伤害和严格阈值，辅助增伤不改变档位', () => {
    const tower = towerById.get('tower_ranger')!
    const result = calculateBuffs(tower, [], [])
    result.appliedTechnologies = [{ technologyId: 'archer_tear', name: '护甲撕裂', family: 'archer', level: 4, description: '', calculated: false }]
    for (const [damage, reduction] of [[10, 0.16], [20, 0.44], [40, 0.72], [40.01, 1]]) {
      result.technologyDamageMin = result.technologyDamageMax = damage
      result.damageMin = result.damageMax = damage * 10
      expect(buildSimulationTechnologies(tower, result, false, 0).input.armorReductionPerHit).toBe(reduction)
    }
  })
  it('已改变的规则指纹撤下模拟效果与肃清立场增益', () => {
    const tower = towerById.get('tower_ranger')!
    const result = calculateBuffs(tower, [], [], doveData.technologyTrees, { treeId: 1, levels: { archer: 6, barrack: 0, mage: 0, engineer: 0 } })
    const invalid = { ...calculationRules, valid: false, invalidFiles: ['kr1/upgrades.lua'] }
    expect(buildSimulationTechnologies(tower, result, true, 10, invalid).effects).toEqual([])
    expect(buildSimulationTechnologies(tower, result, true, 10, invalid).input).toEqual({})
    expect(purgeDamageBonus(30, invalid)).toBe(0)
  })
  it('奥术碎裂的射线例外对应奥术法师，普通低伤弹丸不因辅助增伤跨档', () => {
    const mage = towerById.get('tower_arcane_wizard')!
    const result = calculateBuffs(mage, [], [])
    result.appliedTechnologies = [{ technologyId: 'mage_arcane_shatter', name: '奥术碎裂', family: 'mage', level: 4, description: '', calculated: false }]
    result.technologyDamageMax = 49
    result.damageMax = 98
    expect(buildSimulationTechnologies(mage, result, false, 0).input.armorReductionPerHit).toBe(3.5)
    expect(buildSimulationTechnologies(towerById.get('tower_arcane')!, result, false, 0).input.armorReductionPerHit).toBe(2)
    expect(buildSimulationTechnologies(towerById.get('tower_wizard')!, result, false, 0).input.armorReductionPerHit).toBe(2)
  })
})
