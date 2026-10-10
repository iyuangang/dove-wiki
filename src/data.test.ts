import { describe, expect, it } from 'vitest'
import { doveData, enemies, gameChangelog, heroes, towerById, towers } from './data'
import mechanicReview from '../tools/tower-mechanics-review.json'

describe('游戏百科顺序与图像', () => {
  it('修复名称碰撞、禁止效果和动画误标，并保留实际技能能力', () => {
    expect(towerById.get('tower_barbarian')!.roles).toEqual(['直接输出', '范围伤害', '召唤/拦截'])
    expect(towerById.get('tower_high_elven')!.roles).not.toContain('持续伤害')
    expect(towerById.get('tower_silver')!.roles).not.toContain('经济辅助')
    expect(towerById.get('tower_silver')!.roles).toContain('减益/破甲')
    for (const id of ['tower_arcane', 'tower_elf', 'tower_deep_devils', 'tower_wild_magus', 'tower_tesla']) {
      expect(towerById.get(id)!.roles).toContain('控制')
    }
    const shaolin = towerById.get('tower_shaolin')!
    expect(shaolin.roles.includes('控制')).toBe(
      shaolin.mechanics.items.some((item) => item.id === 'shaolin-control'),
    )
    expect(towerById.get('tower_pixie')!.roles).toContain('经济辅助')
    expect(towerById.get('tower_tesla')!.roles).not.toContain('持续伤害')
    for (const t of towers) {
      expect(new Set(t.roleEvidence.map((e) => e.role))).toEqual(new Set(t.roles))
      expect(t.roleEvidence.every((e) => e.description && e.source)).toBe(true)
    }
  })
  it('实战机制记录实际审阅版本，待复核条目不作为已核实结论显示', () => {
    for (const tower of towers) {
      expect(tower.mechanics.reviewedVersion).toBe(mechanicReview.version)
      expect(new Set(tower.mechanics.pending).size).toBe(tower.mechanics.pending.length)
      expect(new Set(tower.mechanics.items.map((item) => item.id)).size).toBe(tower.mechanics.items.length)
      for (const item of tower.mechanics.items) {
        expect(tower.mechanics.pending, `${tower.id}:${item.id}`).not.toContain(item.title)
        expect(item.sources.length).toBeGreaterThan(0)
        expect(item.sources.every((source) => source.file.endsWith('.bin')
          ? source.line === null && source.symbol.startsWith('shaolin_monk_lvl4_')
          : source.line !== null && source.line > 0)).toBe(true)
        expect(item.sources.every((source) => source.file in mechanicReview.files)).toBe(true)
        expect(JSON.stringify(item)).not.toMatch(/NaN|undefined/)
      }
    }
    const shaolin = towerById.get('tower_shaolin')!
    expect(shaolin.mechanics.hasSpecificReview).toBe(true)
    expect([...shaolin.mechanics.items.map((item) => item.title), ...shaolin.mechanics.pending]).toEqual(
      expect.arrayContaining(['普攻自带控制：条件与实际时长', '僧众分摊目标与集中攻击衰减']),
    )
    expect(towerById.get('tower_archer_1')!.mechanics.hasSpecificReview).toBe(false)
  })
  it('当前审阅提交的已有条目完成复核，四座新增塔保留专属机制', () => {
    if (doveData.metadata.commitHash !== mechanicReview.gameCommit) return
    expect(towers.flatMap((tower) => tower.mechanics.pending)).toEqual([])
    for (const [id, required] of [
      ['tower_catapult', ['catapult-direction', 'catapult-tar', 'catapult-extra-explosion', 'catapult-traps', 'catapult-ultimate']],
      ['tower_archers', ['archers-rotation', 'archers-lines', 'archers-range', 'archers-mark', 'archers-haste']],
      ['tower_wizard', ['wizard-double-bolt', 'wizard-firebook', 'wizard-empower', 'wizard-copies', 'wizard-ultimate']],
      ['tower_knights', ['knights-heroes', 'knights-overheal', 'knights-fallen', 'knights-last-stand']],
    ] as const) {
      const tower = towerById.get(id)!
      expect(tower.mechanics.hasSpecificReview, id).toBe(true)
      expect(tower.mechanics.items.map((item) => item.id), id).toEqual(expect.arrayContaining([...required]))
    }
    expect(towerById.get('tower_archers')!.roles).toEqual(expect.arrayContaining(['增距辅助', '减益/破甲']))
    expect(towerById.get('tower_wizard')!.roles).toContain('增伤辅助')
    expect(towerById.get('tower_knights')!.roles).toContain('增伤辅助')
    expect(towerById.get('tower_wizard')!.attack.scope).toContain('单枚')
    const furnace = towerById.get('tower_melting_furnace')!.mechanics.items.find((item) => item.id === 'furnace-penetration')!
    expect(furnace.details.join(' ')).toContain('不会再次乘冷却系数')
    expect(towerById.get('tower_tricannon_lvl4')!.mechanics.items.some((item) => item.id === 'tricannon-overheat')).toBe(true)
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

  it('2.0.9.3 复核补齐三座新塔并保留骑士实际眩晕流程', () => {
    if (doveData.metadata.commitHash !== mechanicReview.gameCommit) return
    for (const [id, count] of [['tower_culverine', 5], ['tower_elf_ranger', 4], ['tower_wildcat', 5]] as const) {
      const tower = towerById.get(id)!
      expect(tower.mechanics.items.filter((item) => item.kind !== 'damage-rule'), id).toHaveLength(count)
    }
    const item = (tower: string, id: string) => towerById.get(tower)!.mechanics.items.find((item) => item.id === id)!
    expect(item('tower_knights', 'knights-stun').details.join(' ')).toContain('单体近战函数没有读取')
    expect(item('tower_culverine', 'culverine-shred').summary).toContain('3 / 5 / 7 个百分点')
    expect(towerById.get('tower_culverine')!.roles).toContain('减益/破甲')
    expect(towerById.get('tower_culverine')!.attack.scope).toContain('落点范围')
    expect(item('tower_elf_ranger', 'elf-ranger-ricochet').formula).toContain('r^k')
    expect(item('tower_wildcat', 'wildcat-rain').summary).toContain('16 / 20 / 24 枚')
    expect(towerById.get('tower_wildcat')!.roles).toContain('范围伤害')
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
    expect(enemies).toHaveLength(doveData.summary.enemyCount)
    expect(new Set(enemies.map((enemy) => enemy.id)).size).toBe(doveData.summary.uniqueEnemyCount)
    expect(enemies.slice(0, 4).map((enemy) => enemy.id)).toEqual([
      'enemy_goblin',
      'enemy_fat_orc',
      'enemy_shaman',
      'enemy_ogre',
    ])
    expect(enemies.map((enemy) => enemy.order)).toEqual(
      Array.from({ length: enemies.length }, (_, index) => index + 1),
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

  it('KR Genesis 敌人使用独立图集，不与联盟的相同编号串图', () => {
    expect(enemies[298]?.sourceGame).toBe(5)
    expect(enemies[299]).toMatchObject({
      id: 'enemy_bandit_kr6', sourceGame: 6,
      imageSprite: 'kr6_encyclopedia_creeps_0001',
      thumbnailSprite: 'kr6_encyclopedia_creep_thumbs_0001',
    })
    const veznan = enemies.find((enemy) => enemy.id === 'enemy_stage_218_veznan')!
    expect(veznan).toMatchObject({
      sourceGame: 6,
      imageSprite: 'kr6_encyclopedia_creeps_0061',
      thumbnailSprite: 'kr6_encyclopedia_creep_thumbs_0061',
    })
    expect(enemies.filter((enemy) => enemy.sourceGame === 6)).toHaveLength(55)
    for (const enemy of enemies) {
      const prefix = enemy.sourceGame === 1 ? '' : `kr${enemy.sourceGame}_`
      expect(enemy.imageSprite, enemy.id).toMatch(new RegExp(`^${prefix}encyclopedia_creeps_`))
      expect(enemy.thumbnailSprite, enemy.id).toMatch(new RegExp(`^${prefix}encyclopedia_creep_thumbs_`))
    }
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
