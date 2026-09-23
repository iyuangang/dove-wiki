import { describe, expect, it } from 'vitest'
import { inferTowerRoles } from './tower-roles.mjs'

const raw = (references = {}, extra = {}) => ({ id: 'test', families: [], computed_info: { damage_min: 10 }, template: {}, references, ...extra })
const tower = (extra = {}) => ({ units: [], mechanics: { items: [] }, ...extra })

describe('防御塔定位依据', () => {
  it('技能名称、动画、特效、说明中的控制词不构成能力证据', () => {
    const r = raw({ fx_teleport: {}, pop_golden: {}, fx_burn_explosion: { damage_radius: 50 } }, {
      localized: { description: '冰冻、燃烧、金币与龙卷风只是背景故事' },
      template: { powers: { twister: { level: 0 } }, attacks: { list: [{ animation: 'twister' }] } },
    })
    expect(inferTowerRoles(r, tower()).roles).toEqual(['纯输出', '直接输出'])
  })
  it('范围旋风斩是伤害能力，普通士兵阻挡不等于控制', () => {
    const r = raw({ soldier: { melee: { attacks: [{ type: 'area', damage_radius: 40, damage_max: 30 }] } } }, { families: ['barrack'] })
    const result = inferTowerRoles(r, tower())
    expect(result.roles).toEqual(['直接输出', '范围伤害', '召唤/拦截'])
  })
  it('从实际效果类型和执行函数识别控制，包含未使用 stun 命名的沉默', () => {
    const result = inferTowerRoles(raw({ mod_ward: { modifier: {}, script_hooks: { insert: ['mod_silence.insert'] } } }), tower())
    expect(result.roles).toContain('控制')
    expect(result.roleEvidence).toContainEqual({ role: '控制', description: '沉默效果。', source: 'mod_ward' })
    expect(inferTowerRoles(raw({ effect: { modifier: { type: 'slow' }, slow: { factor: 1 } } }), tower()).roles).not.toContain('控制')
  })
  it('免疫用的 poison 类型不算持续伤害，分帧光束也不算持续伤害', () => {
    const r = raw({ mark: { modifier: { type: 'poison' } }, ray: { modifier: { duration: 1 }, dps: { damage_every: 0.1, cocos_cycles: 13 }, script_hooks: { update: ['mod_dps.update'] } } })
    expect(inferTowerRoles(r, tower()).roles).not.toContain('持续伤害')
    r.references.burn = { modifier: { duration: 3 }, dps: { damage_every: 0.25 }, script_hooks: { update: ['mod_dps.update'] } }
    expect(inferTowerRoles(r, tower()).roles).toContain('持续伤害')
  })
  it('少林寺脚本控制只采用有效审阅条目', () => {
    expect(inferTowerRoles(raw(), tower()).roles).not.toContain('控制')
    expect(inferTowerRoles(raw(), tower({ mechanics: { items: [{ id: 'shaolin-control' }] } })).roles).toContain('控制')
  })
  it('金币特效不构成经济能力，实际零起始等级的偷窃参数可以', () => {
    expect(inferTowerRoles(raw({ pop_golden: {} }), tower()).roles).not.toContain('经济辅助')
    expect(inferTowerRoles(raw({ pick: { pickpocket: { steal_max: { 0: 3, 1: 4 } } } }), tower()).roles).toContain('经济辅助')
  })
})
