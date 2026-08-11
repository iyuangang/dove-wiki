import { describe, expect, it } from 'vitest'
import { doveData, towerById, towers } from './data'

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

  it('同时识别关卡主脚本和数据脚本中的塔解锁记录', () => {
    const expectedUnlocks = [
      ['tower_ranger', 5, 'kr1/data/levels/level05_data.lua'],
      ['tower_crossbow', 30, 'kr1/data/levels/level30.lua'],
      ['tower_barrack_mercenaries', 30, 'kr1/data/levels/level30.lua'],
      ['tower_assassin', 30, 'kr1/data/levels/level30.lua'],
      ['tower_dwaarp', 31, 'kr1/data/levels/level31.lua'],
      ['tower_barrack_pirates', 31, 'kr1/data/levels/level31.lua'],
      ['tower_archmage', 32, 'kr1/data/levels/level32.lua'],
      ['tower_barrack_amazonas', 33, 'kr1/data/levels/level33.lua'],
      ['tower_templar', 33, 'kr1/data/levels/level33.lua'],
      ['tower_totem', 34, 'kr1/data/levels/level34.lua'],
      ['tower_necromancer', 35, 'kr1/data/levels/level35.lua'],
      ['tower_mech', 36, 'kr1/data/levels/level36.lua'],
      ['tower_barrack_dwarf', 40, 'kr1/data/levels/level40.lua'],
      ['tower_archer_dwarf', 40, 'kr1/data/levels/level40.lua'],
      ['tower_pirate_watchtower', 42, 'kr1/data/levels/level42.lua'],
      ['tower_frankenstein', 45, 'kr1/data/levels/level45.lua'],
    ] as const

    for (const [towerId, level, source] of expectedUnlocks) {
      expect(towerById.get(towerId)?.unlock).toMatchObject({
        status: 'level',
        level,
        source,
      })
    }

    expect(doveData.validation.unlockAnomalies).toEqual([])
  })
})
