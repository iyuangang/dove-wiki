import { describe, it, expect } from 'vitest'
import { buildTowerMechanics } from './tower-mechanics.mjs'
import { mechanicCatalog } from './tower-mechanics-catalog.mjs'

function fixture(id, template, references) {
  const files = new Map()
  for (const definition of mechanicCatalog[id]) for (const [file, symbol] of definition.sources) {
    files.set(file, { valid: true, text: `${files.get(file)?.text || ''}\n${symbol}\n` })
  }
  const raw = { id, template, references }
  const review = { version: 'fixture', files }
  const build = () => buildTowerMechanics(raw, { attack: {} }, review)
  return { build, review }
}

describe('新增塔的脚本机制', () => {
  it('魔典学者分清单枚面板、两弹齐射、有限副本与大招单体伤害', () => {
    const { build, review } = fixture('tower_wizard', {
      powers: { skill_a: { damage_min: [60, 120, 180], burn_damage: [2, 3, 4] } },
      attacks: { list: [{ bullet: 'bolt', cooldown: 4 }, {}, { cooldown: 25, damage_factor: [1.5, 1.75, 2], duration: [8, 10, 12] }, { hit_min_damage: 50 }, { cooldown: 36 }] },
    }, {
      bolt: { bullet: { damage_min: 10, damage_max: 20 } },
      bullet_firebook_wizard: { bullet: { damage_radius: 60 } },
      mod_firebook_aura: { modifier: { duration: 4 }, dps: { damage_every: 0.25 } },
      aura_wizard_skill_c: { _range: 200, bullet_count: [3, 5, 8], min_damage: [42, 52, 62], max_damage: [76, 92, 108] },
      mod_ultimate_wizard: { damage: 600, stun_range: 45 }, mod_stun_ultimate_wizard: { modifier: { duration: 1 } },
    })
    const result = build()
    expect(result.pending).toEqual([])
    const item = (id) => result.items.find((i) => i.id === id)
    expect(item('wizard-double-bolt').details.join(' ')).toContain('20–40')
    expect(item('wizard-double-bolt').details.join(' ')).toContain('7.5 DPS')
    expect(item('wizard-copies').summary).toContain('3 / 5 / 8')
    expect(item('wizard-ultimate').summary).toContain('选中且仍存活')
    expect(item('wizard-ultimate').details.join(' ')).toContain('周围敌人不会同时分到')
    review.files.get('all/script_utils.lua').valid = false
    expect(build().items.map((i) => i.id)).not.toContain('wizard-empower')
    expect(build().items.map((i) => i.id)).toContain('wizard-ultimate')
  })

  it('弓兵要塞保留共用调度、射程距离衰减、Boss 易伤折半与普攻专属加速', () => {
    const { build } = fixture('tower_archers', {
      shooters_sids: [3, 6, 8, 9],
      powers: { skill_a: { stun_duration: [2, 4, 6] }, skill_b: { range_factor: [1.15, 1.25, 1.35] } },
      attacks: { list: [{ cooldown: 0.45 }, { cooldown: 15, targets: 2 }, {}, { cooldown: 12 }, { cooldown: 36, duration: 6 }] },
    }, { mod_archers_skill_c_weak: { received_damage_factor_config: [1.3, 1.5, 1.75], modifier_duration: [5, 6, 7] }, mod_archers_ultimate_haste: { cooldown_factor: 0.5 } })
    const items = build().items
    expect(items.find((i) => i.id === 'archers-rotation').details.join(' ')).toContain('不能将面板 DPS 再乘以四')
    expect(items.find((i) => i.id === 'archers-range').formula).toContain('d / (2R)')
    expect(items.find((i) => i.id === 'archers-mark').details.join(' ')).toContain('1.15 / 1.25 / 1.375')
    expect(items.find((i) => i.id === 'archers-haste').details.join(' ')).toContain('0.225 秒')
  })

  it('骑士团保留超额治疗、尸体条件和反伤的原始伤害口径', () => {
    const { build } = fixture('tower_knights', {}, {
      soldier_knights: { health: { hp_max: 200 }, powers: {
        skill_a: { extra_armor: [0.05, 0.1, 0.15], hero_damage_factor: [0.1, 0.2, 0.3] },
        skill_b: { hp_ptg: [0.25, 0.4, 0.6], hp_overflow_factor: 2 }, skill_c: { cd_mult: [0.8, 0.6, 0.4] },
      }, melee: { attacks: [{ cooldown: 1 }] }, timed_attacks: { list: [{ cooldown: 15, cast_times: [8 / 30, 18 / 30] }, { hp_trigger: 0.35, cooldown: 30, duration: 5 }] } },
      aura_knights_skill_a: { aura: { radius: 120 } }, aura_knights_skill_c_check: { aura: { radius: 120 } },
    })
    const items = build().items
    expect(items.find((i) => i.id === 'knights-overheal').details.join(' ')).toContain('50 / 80 / 120 点')
    expect(items.find((i) => i.id === 'knights-overheal').details.join(' ')).toContain('400 点当前生命')
    expect(items.find((i) => i.id === 'knights-fallen').details.join(' ')).toContain('移动离开尸体不会撤销')
    expect(items.find((i) => i.id === 'knights-last-stand').formula).toContain('damage.value')
  })

  it('皇家投石机区分方向计时、替换普攻、延迟爆炸与一次性陷阱', () => {
    const { build } = fixture('tower_catapult', {
      rotation_time: 29 / 30, powers: { skill_c: { max_traps: [3, 4, 5] } },
      attacks: { list: [{ cooldown: 5.3 }, { cooldown: 15 }, { cooldown: 7, max_range: 120, min_dist_between_traps: 50 }, { cooldown: 30 }] },
    }, {
      bullet_catapult_skill_a: { bullet: { damage_min: 114, damage_max: 189 } },
      aura_catapult_skill_a: { aura: { radius: 60, duration_conf: [6, 8, 10] } },
      mod_catapult_skill_a_slow: { slow_factor_config: [0.6, 0.5, 0.4] },
      aura_catapult_skill_b_bomb: { explosion_delay: 0.1, cast_time: 10 / 30, damage_radius: 60, damage_min_conf: [38, 75, 113], damage_max_conf: [63, 126, 189] },
      aura_catapult_skill_c_trap: { aura: { radius: 40 } }, mod_catapult_skill_c_stun: { stun_duration_config: [1, 2, 3] },
      aura_catapult_ultimate: { aura: { cycle_time: 5 / 30 }, damage_min: 75, max_nodes: 50, explosion_damage_radius: 75, explosion_damage_min: 120 },
    })
    const items = build().items
    expect(items.find((i) => i.id === 'catapult-direction').details.join(' ')).toContain('合计 1.933 秒')
    expect(items.find((i) => i.id === 'catapult-tar').summary).toContain('占用下一次普攻')
    expect(items.find((i) => i.id === 'catapult-extra-explosion').details.join(' ')).toContain('0.433 秒')
    expect(items.find((i) => i.id === 'catapult-traps').details.join(' ')).toContain('每个陷阱只触发一次')
  })
})
