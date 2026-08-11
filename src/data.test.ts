import { describe, expect, it } from 'vitest'
import { doveData, enemies, heroes, towerById, towers } from './data'

describe('游戏百科顺序与图像', () => {
  it('uses the build id as the public game version', () => {
    expect(doveData.metadata.gameVersion).toBe('2.0.5.8')
    expect(doveData.metadata.contentVersion).toBe('5.6.12')
    expect(doveData.metadata.gameId).toBe('kingdom_rush_dove')
  })

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

    const towerSupportIcons = doveData.supportEffects
      .filter((effect) => effect.sourceType === 'tower')
      .map((effect) =>
      towerById
        .get(effect.sourceTowerId || '')
        ?.powers.find((power) => power.id === effect.skillId)?.icon,
      )
    expect(towerSupportIcons.every((icon) => icon?.startsWith('/skills/'))).toBe(true)

    const heroSupportIcons = doveData.supportEffects
      .filter((effect) => effect.sourceType === 'hero')
      .map((effect) => effect.icon)
    expect(heroSupportIcons.every((icon) => icon?.startsWith('/heroes/thumbs/'))).toBe(true)
  })

  it('extracts the full hero hall with portraits and calculable support heroes', () => {
    expect(heroes).toHaveLength(75)
    expect(heroes.every((hero) => hero.name && hero.description && hero.sources.template)).toBe(true)
    expect(heroes.every((hero) => hero.image.startsWith('/heroes/'))).toBe(true)
    expect(heroes.every((hero) => hero.thumbnail.startsWith('/heroes/thumbs/'))).toBe(true)
    expect(doveData.summary.supportHeroCount).toBe(7)
    expect(doveData.supportEffects.filter((effect) => effect.sourceType === 'hero')).toHaveLength(8)
  })

  it('mirrors the in-game enemy encyclopedia order, duplicates and images', () => {
    expect(enemies).toHaveLength(299)
    expect(new Set(enemies.map((enemy) => enemy.id)).size).toBe(295)
    expect(enemies.slice(0, 4).map((enemy) => enemy.id)).toEqual([
      'enemy_goblin',
      'enemy_fat_orc',
      'enemy_shaman',
      'enemy_ogre',
    ])
    expect(enemies.map((enemy) => enemy.order)).toEqual(
      Array.from({ length: 299 }, (_, index) => index + 1),
    )
    expect(enemies.filter((enemy) => enemy.id === 'enemy_halloween_zombie')).toHaveLength(2)
    expect(enemies.every((enemy) => enemy.name && enemy.description)).toBe(true)
    expect(enemies.every((enemy) => enemy.image.startsWith('/enemies/'))).toBe(true)
    expect(enemies.every((enemy) => enemy.thumbnail.startsWith('/enemies/thumbs/'))).toBe(true)
    expect(enemies[67]?.sourceGame).toBe(1)
    expect(enemies[68]?.sourceGame).toBe(2)
    expect(enemies[128]?.sourceGame).toBe(3)
    expect(enemies[173]?.sourceGame).toBe(5)
  })

  it('extracts all four six-level technology trees from upgrades.lua', () => {
    expect(doveData.technologyTrees).toHaveLength(4)
    expect(doveData.summary.technologyCount).toBe(96)
    expect(
      doveData.technologyTrees.every(
        (tree) => tree.maxLevel === 6 && tree.technologies.length === 24,
      ),
    ).toBe(true)
    expect(doveData.technologyTrees.map((tree) => tree.name)).toEqual([
      '科技一',
      '科技二',
      '科技三',
      '科技四',
    ])
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
