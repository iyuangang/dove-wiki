import { describe, expect, it } from 'vitest'
import { buildPowerLevels } from './tower-details.mjs'

describe('技能逐级数据', () => {
  it('首级使用购买价，之后每级使用固定升级价，按实际等级匹配说明', () => {
    const power = { maxLevel: 3, priceBase: 325, priceIncrement: 150, descriptions: [
      { key: 'TOWER_TEST_SKILL_DESCRIPTION_3', text: '三级' },
      { key: 'TOWER_TEST_SKILL_1_DESCRIPTION', text: '一级' },
      { key: 'TOWER_TEST_SKILL_DESCRIPTION_2', text: '二级' },
      { key: 'TOWER_TEST_SKILL_DESCRIPTION', text: '通用' },
    ] }
    const levels = buildPowerLevels(power, { cooldown_base: 22, cooldown_inc: -2 })
    expect(levels.map((level) => level.description)).toEqual(['一级', '二级', '三级'])
    expect(levels.map((level) => level.price)).toEqual([325, 150, 150])
    expect(levels.map((level) => level.cumulativePrice)).toEqual([325, 475, 625])
    expect(levels.map((level) => level.parameters[0].value)).toEqual([20, 18, 16])
  })

  it('缺少某级说明时不拿最高级说明替代，未知费用不显示为免费', () => {
    const power = { maxLevel: 3, priceBase: null, priceIncrement: 0, descriptions: [
      { key: 'TOWER_TEST_SKILL_DESCRIPTION_3', text: '最高级伤害100' },
    ] }
    const levels = buildPowerLevels(power, {})
    expect(levels[0].descriptionSource).toBe('missing')
    expect(levels[0].description).not.toContain('100')
    expect(levels[0].price).toBeNull()
    expect(levels[2].cumulativePrice).toBeNull()
  })

  it('使用运行时解析结果，保留解析失败标志和缺失数组项', () => {
    const key = 'TOWER_TEST_SKILL_DESCRIPTION_1'
    const power = { maxLevel: 2, priceBase: 100, priceIncrement: 50, descriptions: [{ key, text: '动态数值' }] }
    const levels = buildPowerLevels(power, { cooldown: [15] }, { [key]: { text: '每15秒触发', unresolved: false } })
    expect(levels[0]).toMatchObject({ description: '每15秒触发', unresolved: false })
    expect(levels[1].parameters).toEqual([])
    expect(buildPowerLevels(power, {}, { [key]: { text: '[数值未解析]', unresolved: true } })[0].unresolved).toBe(true)
  })
})
