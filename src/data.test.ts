import { describe, expect, it } from 'vitest'
import { doveData, enemies, gameChangelog, heroes, towerById, towers } from './data'

describe('游戏百科顺序与图像', () => {
  it('实战机制包含可靠来源、版本和少林寺条件，未核实的塔不伪装成已完成', () => {
    for (const tower of towers) {
      expect(tower.mechanics.reviewedVersion).toBe(doveData.metadata.gameVersion)
      expect(tower.mechanics.pending).toEqual([])
      for (const item of tower.mechanics.items) {
        expect(item.sources.length).toBeGreaterThan(0)
        expect(item.sources.every((source) => source.line !== null && source.line > 0)).toBe(true)
        expect(JSON.stringify(item)).not.toMatch(/NaN|undefined/)
      }
    }
    const shaolin = towerById.get('tower_shaolin')!
    const control = shaolin.mechanics.items.find((item) => item.id === 'shaolin-control')!
    expect(control.summary).toContain('没有士兵阻挡')
    expect(control.details.join(' ')).toContain('0.7 秒')
    expect(shaolin.mechanics.items.find((item) => item.id === 'shaolin-distribution')?.formula).toContain('ceil')
    expect(towerById.get('tower_archer_1')!.mechanics.hasSpecificReview).toBe(false)
  })
  it('所有塔技能保留连续等级、费用和已展开的对应等级说明', () => {
    for (const tower of towers) {
      for (const power of tower.powers) {
        expect(power.levels.map((level) => level.level)).toEqual(Array.from({ length: power.maxLevel }, (_, i) => i + 1))
        for (const level of power.levels) {
          expect(level.descriptionSource).toBe('level')
          expect(level.unresolved).toBe(false)
          expect(level.description).not.toMatch(/动态数值|%\$|数值未解析/)
          expect(level.price).toBe(level.level === 1 ? power.priceBase : power.priceIncrement)
        }
      }
    }
  })

  it('少林寺包含可调集神龙大侠完整属性与人多势众的三级人数', () => {
    const tower = towerById.get('tower_shaolin')!
    expect(tower.units).toHaveLength(1)
    expect(tower.units[0]).toMatchObject({
      id: 'soldier_dragon', name: '神龙大侠', count: 1, controllable: true, rallyRange: 180,
      relatedPowerIds: ['dragon'],
      stats: { hp: 400, armor: 0, magicArmor: 0, respawn: 13, speed: 30 },
    })
    expect(tower.units[0]?.stats.attacks[0]).toMatchObject({ damageMin: 40, damageMax: 60, cooldown: 1, radius: 37.5, damageType: '物理' })
    expect(tower.powers.find((p) => p.id === 'total')?.levels.map((l) => l.description)).toEqual([
      '将僧众人数升至4名。', '将僧众人数升至5名。', '将僧众人数升至6名。',
    ])
    expect(tower.roles).toContain('召唤/拦截')
    expect(tower.roles).not.toContain('纯输出')
  })

  it('召唤物属性随技能成长，血肉傀儡的范围招式仅在三级启用', () => {
    const elemental = towerById.get('tower_sorcerer')!.units[0]!
    expect(elemental.variants.map((v) => v.hp)).toEqual([600, 700, 800])
    expect(elemental.variants.map((v) => v.attacks[0]?.damageMin)).toEqual([30, 40, 50])
    const frankie = towerById.get('tower_frankenstein')!.units[0]!
    expect(frankie.variants.map((v) => v.attacks[1]?.disabled)).toEqual([true, true, false])
    expect(frankie.variants.map((v) => v.armor)).toEqual([0.2, 0.4, 0.6])
  })

  it('召唤物不包含光环受益单位，也不会把相似塔名的技能混入', () => {
    expect(towerById.get('tower_necromancer')!.units.map((u) => u.id)).toEqual([
      'soldier_death_rider', 'soldier_skeleton', 'soldier_skeleton_knight',
    ])
    expect(towerById.get('tower_paladin')!.units.map((u) => u.id)).toEqual(['soldier_paladin'])
    expect(towerById.get('tower_paladin')!.powers.find((p) => p.id === 'healing')?.levels[0]?.descriptionKey).toBe('TOWER_PALADIN_HEALING_DESCRIPTION_1')
    expect(towerById.get('tower_grim_cemetery')!.units.map((u) => u.id)).toEqual(['soldier_zombie', 'soldier_zombie_big', 'soldier_zombie_medium'])
  })

  it('uses the build id as the public game version', () => {
    expect(doveData.metadata.gameVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
    expect(doveData.metadata.contentVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(doveData.metadata.gameId).toBe('kingdom_rush_dove')
  })

  it('按 map_data.tower_data 的开头顺序排列', () => {
    expect(towers).toHaveLength(doveData.summary.towerCount)
    expect(new Set(towers.map((tower) => tower.id)).size).toBe(towers.length)
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
      Array.from({ length: towers.length }, (_, index) => index + 1),
    )
  })

  it('百科塔使用百科图，基础塔使用头像回退', () => {
    const listed = towers.filter((tower) => tower.encyclopediaListed)
    const fallback = towers.filter((tower) => !tower.encyclopediaListed)

    expect(listed).toHaveLength(doveData.summary.encyclopediaImageCount)
    expect(fallback).toHaveLength(doveData.summary.portraitFallbackCount)
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
    expect(heroes).toHaveLength(doveData.summary.heroCount)
    expect(new Set(heroes.map((hero) => hero.id)).size).toBe(heroes.length)
    expect(doveData.validation.missingTemplateSources).toEqual([])
    expect(heroes.every((hero) => hero.name && hero.description && hero.sources.template)).toBe(true)
    expect(heroes.every((hero) => hero.image.startsWith('/heroes/'))).toBe(true)
    expect(heroes.every((hero) => hero.thumbnail.startsWith('/heroes/thumbs/'))).toBe(true)
    expect(heroes.every((hero) => hero.abilities.length === hero.specialties.length)).toBe(true)
    expect(heroes.flatMap((hero) => hero.abilities).every((ability) => ability.description)).toBe(true)
    expect(
      heroes.flatMap((hero) => hero.abilities).every(
        (ability) => !ability.description.includes('未提供可直接展示'),
      ),
    ).toBe(true)
    expect(heroes.find((hero) => hero.id === 'hero_gerald')?.abilities).toContainEqual(
      expect.objectContaining({ name: '神圣打击' }),
    )
    expect(doveData.summary.supportHeroCount).toBe(7)
    expect(doveData.supportEffects.filter((effect) => effect.sourceType === 'hero')).toHaveLength(8)
  })

  it('记录相邻游戏版本的数据差异', () => {
    expect(gameChangelog.releases.length).toBeGreaterThanOrEqual(2)
    expect(gameChangelog.releases[0]?.version).toBe(doveData.metadata.gameVersion)
    expect(gameChangelog.releases.find((release) => release.version === '2.0.6.2')).toMatchObject({
      version: '2.0.6.2',
      previousVersion: '2.0.5.9',
      summary: { changeCount: 11 },
    })
    expect(gameChangelog.releases.flatMap((release) => release.changes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'hero', kind: 'added', entityName: '极狗' }),
        expect.objectContaining({ category: 'hero', kind: 'added', entityName: '特拉敏大师' }),
        expect.objectContaining({
          category: 'tower',
          kind: 'balance',
          entityName: '女巫姐妹花',
        }),
      ]),
    )
  })

  it('mirrors the in-game enemy encyclopedia order, duplicates and images', () => {
    expect(enemies).toHaveLength(300)
    expect(new Set(enemies.map((enemy) => enemy.id)).size).toBe(296)
    expect(enemies.slice(0, 4).map((enemy) => enemy.id)).toEqual([
      'enemy_goblin',
      'enemy_fat_orc',
      'enemy_shaman',
      'enemy_ogre',
    ])
    expect(enemies.map((enemy) => enemy.order)).toEqual(
      Array.from({ length: 300 }, (_, index) => index + 1),
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
    expect(doveData.summary.technologyCount).toBe(144)
    expect(
      doveData.technologyTrees.every(
        (tree) => tree.maxLevel === 6 && tree.technologies.length === 36,
      ),
    ).toBe(true)
    expect(doveData.technologyTrees.map((tree) => tree.name)).toEqual([
      '科技一',
      '科技二',
      '科技三',
      '科技四',
    ])
    expect(
      doveData.technologyTrees.every((tree) =>
        ['archer', 'barrack', 'mage', 'engineer', 'rain', 'reinforcement'].every(
          (family) =>
            tree.technologies.filter((technology) => technology.family === family).length === 6,
        ),
      ),
    ).toBe(true)
    expect(
      doveData.technologyTrees.every((tree) =>
        tree.technologies.every(
          (technology) =>
            technology.icon.startsWith('/technologies/') && Boolean(technology.iconSprite),
        ),
      ),
    ).toBe(true)
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
