import { describe, expect, it } from 'vitest'
import { towers } from './data'

describe('游戏百科顺序与图像', () => {
  it('按 map_data.tower_data 的开头顺序排列', () => {
    expect(towers.slice(0, 10).map((tower) => tower.id)).toEqual([
      'tower_ranger',
      'tower_paladin',
      'tower_arcane_wizard',
      'tower_bfg',
      'tower_musketeer',
      'tower_barbarian',
      'tower_sorcerer',
      'tower_tesla',
      'tower_elf',
      'tower_sunray',
    ])
    expect(towers.map((tower) => tower.encyclopediaOrder)).toEqual(
      Array.from({ length: 93 }, (_, index) => index + 1),
    )
  })

  it('百科塔使用百科图，基础塔使用头像回退', () => {
    const listed = towers.filter((tower) => tower.encyclopediaListed)
    const fallback = towers.filter((tower) => !tower.encyclopediaListed)

    expect(listed).toHaveLength(81)
    expect(listed.every((tower) => tower.image.startsWith('/encyclopedia/thumbs/'))).toBe(true)
    expect(listed.every((tower) => tower.encyclopediaImage.startsWith('/encyclopedia/'))).toBe(true)
    expect(fallback.map((tower) => tower.id)).toEqual([
      'tower_archer_1',
      'tower_archer_2',
      'tower_archer_3',
      'tower_mage_1',
      'tower_mage_2',
      'tower_mage_3',
      'tower_engineer_1',
      'tower_engineer_2',
      'tower_engineer_3',
      'tower_barrack_1',
      'tower_barrack_2',
      'tower_barrack_3',
    ])
    expect(fallback.every((tower) => tower.image.startsWith('/portraits/'))).toBe(true)
  })

  it('从游戏塔菜单图集关联技能图标', () => {
    const powers = towers.flatMap((tower) => tower.powers)
    const powersWithIcons = powers.filter((power) => power.icon)

    expect(powersWithIcons.length).toBeGreaterThan(100)
    expect(powersWithIcons.every((power) => power.icon?.startsWith('/skills/'))).toBe(true)
    expect(powersWithIcons.every((power) => power.iconSprite)).toBe(true)
  })
})
