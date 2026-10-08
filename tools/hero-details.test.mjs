import { describe, expect, it } from 'vitest'
import { buildHeroDetails, mergeHeroSnapshot } from './hero-details.mjs'

function fixture(id, behavior = {}, skills = {}) {
  const raw = { id, behavior: { is_flying: false, motion: { max_speed: 90 }, ...behavior }, template: { hero: { skills } } }
  const review = { version: 'test', files: new Map([
    ['kr1/heroes.lua', { valid: true, text: `RT("${id}"\nE:register_t("${id}"` }],
    ['kr1/hero_scripts.lua', { valid: true, text: `scripts.${id} =` }],
    ['all/script_utils.lua', { valid: true, text: 'function SU.y_hero_new_rally(\nfunction SU.hero_will_teleport(' }],
  ]) }
  return { raw, review }
}

function reviewedDetails(id, behavior = {}, skills = {}) {
  const { raw, review } = fixture(id, behavior, skills)
  const result = buildHeroDetails(raw, review)
  expect(result.pending, id).toEqual([])
  return result
}

function facts(details, id) {
  const item = details.items.find((item) => item.id === id)
  expect(item, id).toBeDefined()
  return item.facts.join(' ')
}

describe('英雄行为来源与移动分类', () => {
  it('英雄单独更新保留塔、敌人、科技、辅助与原始版本，不产生跨版本覆盖', () => {
    const previous = { metadata: { gameVersion: 'old' }, summary: { heroCount: 1, towerCount: 94 }, towers: [{ id: 'tower' }], enemies: [{ id: 'enemy' }], technologyTrees: [1], supportEffects: [2], validation: { warnings: [] } }
    const next = mergeHeroSnapshot(previous, [{ id: 'hero' }], { gameVersion: 'new' })
    for (const key of ['towers', 'enemies', 'technologyTrees', 'supportEffects', 'validation']) expect(next[key]).toBe(previous[key])
    expect(next.metadata.gameVersion).toBe('old')
    expect(next.metadata.heroSnapshot.gameVersion).toBe('new')
    expect(previous.metadata.heroSnapshot).toBeUndefined()
  })
  it('名字、技能传送与悬浮外观都不等同于英雄的飞行或调动传送', () => {
    const { raw, review } = fixture('hero_flying_teleport', { nav_grid: { ignore_waypoints: true }, timed_attacks: { list: [{ name: 'teleport', vis_bans: 128 }] } })
    const result = buildHeroDetails(raw, review)
    expect(result.movement.tags).toEqual(['地面'])
    expect(result.items.map((x) => x.id)).not.toContain('teleport')
  })
  it('默认关闭的传送不得直接标为已启用', () => {
    const { raw, review } = fixture('hero_test', { teleport: { disabled: true, min_distance: 45 } })
    const result = buildHeroDetails(raw, review)
    expect(result.movement.tags).not.toContain('传送')
    expect(result.items.find((i) => i.id === 'teleport').facts.join(' ')).toContain('默认关闭')
  })
  it('光翼传送保留技能解锁条件，潜地与变形不会误标常驻飞行', () => {
    const { raw, review } = fixture('hero_priest', { teleport: { disabled: true, min_distance: 51.2 } }, { wingsoflight: { xp_level_steps: { 1: 1, 4: 2 } } })
    const result = buildHeroDetails(raw, review)
    expect(result.movement.tags).toEqual(['地面', '传送'])
    expect(result.items[0].facts.join(' ')).toContain('英雄 Lv.1')
    expect(result.items[0].facts.join(' ')).toContain('严格大于 51.2')
  })
  it('源码指纹失效时撤下已核实的机制和筛选标签，保留原始速度', () => {
    const { raw, review } = fixture('hero_alric', { transfer: { min_distance: 90, extra_speed: 60 } })
    review.files.get('all/script_utils.lua').valid = false
    const result = buildHeroDetails(raw, review)
    expect(result.items).toEqual([])
    expect(result.pending).toContain('沙化移动')
    expect(result.movement.tags).toEqual([])
    expect(result.movement.baseSpeed).toBe(90)
  })
  it('缺失来源符号时不显示核实通过的结论', () => {
    const { raw, review } = fixture('hero_dragon', { is_flying: true })
    review.files.get('kr1/hero_scripts.lua').text = ''
    const result = buildHeroDetails(raw, review)
    expect(result.items).toEqual([])
    expect(result.pending).toContain('常驻飞行单位')
  })

  it('已审阅样例区分常驻飞行与赶路形态，并计算变形移速', () => {
    for (const id of ['hero_dragon', 'hero_phoenix']) {
      expect(reviewedDetails(id, { is_flying: true }).movement.tags).toContain('飞行')
    }
    const monkey = reviewedDetails('hero_monkey_god', {
      motion: { max_speed: 108 }, cloudwalk: { min_distance: 300, extra_speed: 108 },
    })
    expect(monkey.movement.tags).toEqual(['地面', '变形加速'])
    expect(facts(monkey, 'travel-form')).toContain('300')
    expect(facts(monkey, 'travel-form')).toContain('216')
    const durax = reviewedDetails('hero_durax', {
      motion: { max_speed: 60 }, transfer: { min_distance: 0, extra_speed: 165 },
    })
    expect(facts(durax, 'transfer')).toContain('225')
    const groundForms = [
      ['hero_vampiress', { motion: { max_speed: 60, max_speed_bat: 150 }, fly_to: { min_distance: 80 } }],
      ['hero_margosa', { treewalk: { min_distance: 120, speed_factor: 2.5 } }],
      ['hero_robot', { flywalk: { min_distance: 80, extra_speed: 110 } }],
      ['hero_wukong', { flywalk: { min_distance: 150, extra_speed_mult: 2.2 } }],
      ['hero_catha', { teleport: { min_distance: 200 } }],
      ['hero_witch', { teleport: { min_distance: 200 } }],
    ]
    for (const [id, behavior] of groundForms) {
      expect(reviewedDetails(id, behavior).movement.tags).not.toContain('飞行')
    }
  })

  it('已审阅样例保留距离边界、横向判定、技能启用与形态限制', () => {
    expect(facts(reviewedDetails('hero_raelyn'), 'raelyn-jump')).toContain('恰好 125 或 300 时不触发')
    expect(facts(reviewedDetails('hero_10yr', { teleport: { min_distance: 200 } }), 'teleport')).toContain('距离大于 200')
    expect(facts(reviewedDetails('hero_priest', { teleport: { disabled: true, min_distance: 51.2 } }, {
      wingsoflight: { xp_level_steps: { 1: 1, 4: 2 } },
    }), 'teleport')).toContain('Lv.1')
    expect(facts(reviewedDetails('hero_crab', { burrow: { min_distance: 100, init_accel: 40 } }, {
      burrow: { xp_level_steps: { 1: 1, 4: 2 } },
    }), 'burrow')).toContain('Lv.1')
    expect(facts(reviewedDetails('hero_venom', { slimewalk: { min_distance: 72, extra_speed: 95 } }), 'travel-form')).toContain('战斗变身')
    expect(facts(reviewedDetails('hero_tramin', { max_dist_walk: 160, flight_time: 0.9 }), 'tramin-jetpack')).toContain('0.9 秒')
    expect(facts(reviewedDetails('hero_xin'), 'xin-rally')).toContain('没有最短距离阈值')
  })

  it('已审阅样例使用残血冷却公式、引擎倍率与蓄能距离', () => {
    expect(facts(reviewedDetails('hero_bolverk', { berserker_factor: 0.5 }), 'berserker')).toContain('半血为 0.75 倍')
    const wilbur = reviewedDetails('hero_wilbur', {
      is_flying: true, motion: { max_speed: 54, max_speed_base: 54 },
    }, { engine: { speed_factor: [1.2, 1.4, 1.6] } })
    expect(wilbur.movement.tags).toContain('飞行')
    expect(facts(wilbur, 'engine-speed')).toContain('1.2 / 1.4 / 1.6')
    expect(reviewedDetails('hero_oni').items.some((item) => item.id === 'oni-missing-health')).toBe(true)
    const gem = reviewedDetails('hero_dragon_gem', { passive_charge: { distance_to_charge: 250 } })
    expect(gem.items.find((item) => item.id === 'travel-charge').summary).toContain('250')
  })
})
