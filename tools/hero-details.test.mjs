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
})
