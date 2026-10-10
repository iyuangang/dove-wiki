import { describe, expect, it } from 'vitest'
import { enemyStats, normalizeEnemy } from './enemy-data.mjs'

describe('敌人字段来源与难度', () => {
  it('百科计算失败时保留可读取的模板字段及错误原因', () => {
    const result = enemyStats({ computed_info_error: 'table arithmetic', template: { health: { hp_max: 900, armor: 0.3 }, melee: { attacks: [{ damage_min: 10, damage_max: 20 }] } } })
    expect(result.stats).toMatchObject({ hp: 900, armor: 0.3, damageMin: 10, damageMax: 20 })
    expect(result.fieldSources.hp).toBe('template.health.hp_max')
    expect(result.infoError).toBe('table arithmetic')
    expect(result.missingFields.speed).toContain('失败')
  })
  it('未展开的数组不冒充任意难度的数值，Boss 免疫标记不等同于首领身份', () => {
    const raw = { id: 'enemy_elite', order: 1, source_game: 1, template: { health: { hp_max: [100, 200, 300] }, vis: { flags: 32 } } }
    const result = normalizeEnemy(raw, {})
    expect(result.stats.hp).toBeNull()
    expect(result.diagnostics.missingFields.hp).toContain('数组')
    expect(result.boss).toBe(false)
  })
  it('默认采用普通难度，并保留四套面板和首领依据', () => {
    const raw = { id: 'enemy_stage_218_veznan', order: 354, source_game: 6, boss_evidence: '模板继承链 → boss', difficulty_stats: [1, 2, 3, 4].map((difficulty) => ({ difficulty, computed_info: { hp_max: difficulty * 100 } })) }
    const result = normalizeEnemy(raw, {})
    expect(result.stats.hp).toBe(200)
    expect(result.statsByDifficulty.map((item) => item.stats.hp)).toEqual([100, 200, 300, 400])
    expect(result.boss).toBe(true)
  })
  it('只有远程攻击的敌人保留远程伤害；无攻击单位说明不适用原因', () => {
    const ranged = enemyStats({ computed_info: { ranged_damage_min: 40, ranged_damage_max: 60, no_ranged: false }, template: {} })
    expect(ranged.stats).toMatchObject({ damageMin: 40, damageMax: 60 })
    expect(ranged.damageScope).toBe('远程')
    const harmless = enemyStats({ computed_info: { no_ranged: true }, template: {} })
    expect(harmless.stats.damageMin).toBeNull()
    expect(harmless.notApplicableFields).toContain('damageMin')
    expect(harmless.missingFields.damageMin).toContain('没有近战或远程')
  })
})
