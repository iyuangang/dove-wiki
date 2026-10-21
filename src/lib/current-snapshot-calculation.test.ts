import { describe, expect, it } from 'vitest'
import { doveData } from '../data'
import { calculateBuffs } from './calculator'
import { buildSimulationTechnologies, calculationRules, purgeDamageBonus } from './calculation-rules'

describe('当前游戏快照的计算审阅边界', () => {
  it('来源失效的辅助不会改变当前塔的伤害、射程、冷却或价格', () => {
    for (const effect of doveData.supportEffects.filter(effect => effect.review?.valid === false)) {
      const tower = doveData.towers.find(tower => tower.canBeBuffed && !effect.excludeTowerIds?.includes(tower.id))!
      const baseline = calculateBuffs(tower, [], [])
      const result = calculateBuffs(tower, doveData.supportEffects, [{ effectId: effect.id, level: effect.levels.at(-1)!.level, triggers: 20 }])
      expect(result.applied, effect.id).toEqual([])
      for (const key of ['damageMin', 'damageMax', 'range', 'cooldown', 'price', 'dps'] as const) {
        expect(result[key], `${effect.id}.${key}`).toBe(baseline[key])
      }
    }
  })

  it('指纹失效时停止条件科技与概率模拟，保持快照的真实审阅状态', () => {
    expect(calculationRules.valid).toBe(calculationRules.invalidFiles.length === 0)
    if (calculationRules.valid) return
    const tower = doveData.towers.find(tower => tower.id === 'tower_arcane_wizard')!
    const result = calculateBuffs(tower, [], [], doveData.technologyTrees, {
      treeId: 4, levels: { archer: 0, barrack: 0, mage: 6, engineer: 0 }, nearbyEnemyCount: 30,
    })
    expect(result.technologyDamageBonus).toBe(0)
    expect(purgeDamageBonus(30)).toBe(0)
    expect(buildSimulationTechnologies(tower, result, false, 30).effects).toEqual([])
    expect(buildSimulationTechnologies(tower, result, false, 30).input).toEqual({})
  })
})
