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
      }, melee: { attacks: [{ cooldown: 1, mod_chance: 0.2 }] }, timed_attacks: { list: [{ cooldown: 15, cast_times: [8 / 30, 18 / 30] }, { hp_trigger: 0.35, cooldown: 30, duration: 5 }] } },
      mod_knights_stun: { modifier: { duration: 1 } },
      aura_knights_skill_a: { aura: { radius: 120 } }, aura_knights_skill_c_check: { aura: { radius: 120 } },
    })
    const items = build().items
    expect(items.find((i) => i.id === 'knights-overheal').details.join(' ')).toContain('50 / 80 / 120 点')
    expect(items.find((i) => i.id === 'knights-overheal').details.join(' ')).toContain('400 点当前生命')
    expect(items.find((i) => i.id === 'knights-fallen').details.join(' ')).toContain('移动离开尸体不会撤销')
    expect(items.find((i) => i.id === 'knights-last-stand').formula).toContain('damage.value')
    expect(items.find((i) => i.id === 'knights-stun').details.join(' ')).toContain('mod_chance = 0.2')
    expect(items.find((i) => i.id === 'knights-stun').details.join(' ')).toContain('单体近战函数没有读取')
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

  it('扩散炮区分永久削甲、短时削抗、连发与按发射次数触发的大招', () => {
    const { build, review } = fixture('tower_culverine', {
      powers: { skill_c: { shots: [2, 4, 6] } },
      attacks: { list: [{ cooldown: 3.1 }, { cooldown: 16, bullet: 'sulfur', min_targets: 3, min_magic_res: 0.3 }, { cooldown: 27 }, { attacks_to_trigger: 6 }] },
    }, {
      aura_bullet_culverine: { aura: { radius: 60, damage_min: 70, damage_max: 89 } },
      mod_bullet_culverine_skill_b: { armor_red_factor_conf: [0.03, 0.05, 0.07] },
      sulfur: { bullet: { damage_radius: 90 }, damage_min_conf: [70, 120, 170], damage_max_conf: [90, 160, 230] },
      aura_bullet_culverine_skill_a: { aura: { duration_conf: [6, 8, 10], cycle_time: 0.25 } },
      mod_bullet_culverine_skill_a: { modifier: { duration: 0.3 } },
      aura_culverine_ultimate: { aura: { damage_min: 98, damage_max: 124 } },
      mod_culverine_ultimate_stun: { modifier: { duration: 2 } },
    })
    const item = (id) => build().items.find((i) => i.id === id)
    expect(item('culverine-splash').summary).toContain('半径 60')
    expect(item('culverine-shred').summary).toContain('3 / 5 / 7 个百分点')
    expect(item('culverine-sulfur').summary).toContain('至少 3 名')
    expect(item('culverine-sulfur').details.join(' ')).toContain('0.3 秒，到期恢复')
    expect(item('culverine-barrage').summary).toContain('2 / 4 / 6 次')
    expect(item('culverine-ultimate').summary).toContain('发射 6 次')
    review.files.get('all/script_utils.lua').valid = false
    expect(build().items.map((i) => i.id)).not.toContain('culverine-shred')
    expect(build().pending).toContain('锋利弹片逐次永久削减物理护甲')
  })

  it('精灵游侠保留毒伤等级、逐跳幂次衰减和严格处决门槛', () => {
    const { build } = fixture('tower_elf_ranger', {
      powers: { skill_a: { arrow_count: 3 }, skill_b: { damage_min: [90, 135, 180], damage_max: [135, 205, 270] }, skill_c: { bounce_damage_mult: [0.4, 0.65, 0.8] } },
      attacks: { list: [{}, { cooldown: 15 }, {}, { cooldown: 32, instakill_hp_threshold: 0.5 }] },
    }, {
      mod_elf_ranger_skill_a_poison: { modifier: { duration_config: [3, 6, 9] }, dps: { damage_inc: 2, damage_every: 0.25 } },
      aura_elf_ranger_skill_b: { aura: { radius: 60, duration_conf: [6, 7, 9] } },
      mod_elf_ranger_skill_b_stun: { modifier: { duration: 2 } },
      mod_elf_ranger_skill_b_slow: { slow: { factor: 0.4 } },
      bullet_elf_ranger_skill_c_bounce_clone: { max_bounces: 3, bounce_range: 100 },
    })
    const item = (id) => build().items.find((i) => i.id === id)
    expect(item('elf-ranger-poison').details.join(' ')).toContain('2 / 4 / 6 点毒伤害')
    expect(item('elf-ranger-bramble').details.join(' ')).toContain('6 / 7 / 9 秒')
    expect(item('elf-ranger-ricochet').details.join(' ')).toContain('40 / 65 / 80%')
    expect(item('elf-ranger-ricochet').formula).toContain('r^k')
    expect(item('elf-ranger-ultimate').summary).toContain('不超过最大生命的 50%')
    expect(item('elf-ranger-ultimate').summary).toContain('严格大于 750')
  })

  it('野猫飞刀计入初次命中，箭雨按布置轮数翻倍且使用魔抗特攻', () => {
    const { build } = fixture('tower_wildcat', {
      barrack: { max_soldiers: 2 }, attacks: { list: [{ cooldown: 35 }] },
    }, {
      soldier_wildcat: { melee: { attacks: [{ damage_min: 25, damage_max: 30 }] }, ranged: { attacks: [{ min_range: 50, max_range: 175 }] }, timed_attacks: { list: [{}, { cooldown: 12 }, { min_targets: 2 }] }, powers: {
        skill_a: { max_bounces: [1, 2, 5], damage_min: [28, 40, 51], damage_max: [36, 56, 64] },
        skill_b: { damage_min: [200, 400, 600], damage_max: [240, 480, 720] },
        skill_c: { arrow_count: [4, 6, 9], damage_min: [8, 13, 18], damage_max: [12, 16, 22] },
      } },
      bullet_wildcat: { bullet: { damage_min: 30, damage_max: 40 } },
      mod_wildcat_skill_b_bleed: { modifier: { duration: 4 }, dps: { damage_min: 3, damage_every: 0.25 } },
      decal_wildcat_skill_c_arrow: { damage_radius: 35 },
      controller_wildcat_ult: { attacks: 4, wait_time: 8 / 30 },
      decal_wildcat_ult_panther: { damage_min: 160, damage_max: 240, hit_time: 13 / 30 },
    })
    const item = (id) => build().items.find((i) => i.id === id)
    expect(item('wildcat-combat').details.join(' ')).toContain('30–40 点物理伤害')
    expect(item('wildcat-knife').summary).toContain('共最多 2 / 3 / 6 次')
    expect(item('wildcat-knife').details.join(' ')).toContain('两个敌人之间往返')
    expect(item('wildcat-rain').summary).toContain('最多 8 / 12 / 18 枚')
    expect(item('wildcat-rain').details.join(' ')).toContain('(1 − M) + 2M²')
    expect(item('wildcat-ultimate').details.join(' ')).toContain('2.167 秒')
  })
})
