// Labels describe available capabilities, including purchased skills and units.
// Never infer gameplay from prose, animation names, exclusion lists or VFX names.
const list = (v) => Array.isArray(v) ? v : []
const any = (v, predicate) => v && typeof v === 'object' ? Object.values(v).some(predicate) : predicate(v)
const positive = (v) => any(v, (n) => Number.isFinite(n) && n > 0)
const hooks = (v) => Object.values(v.script_hooks || {}).flat()
const controlTypes = { stun: '眩晕', freeze: '定身 / 冻结', slow: '减速', teleport: '传送', polymorph: '变形', timelapse: '时空禁锢' }
const controlScripts = {
  'mod_stun.insert': '眩晕', 'mod_stun.update': '眩晕',
  'mod_silence.insert': '沉默', 'mod_freeze.insert': '冻结',
  'mod_thorn.insert': '缠绕', 'mod_teleport.insert': '传送',
  'mod_polymorph.insert': '变形', 'mod_timelapse.insert': '时空禁锢',
  'mod_possession.insert': '附身控制',
  'mod_tower_necromancer_skill_debuff.insert': '沉默',
  'mod_tesla_overcharge.insert': '过载概率眩晕',
}

export function inferTowerRoles(raw, tower, supportIds = new Map()) {
  const evidence = []
  const add = (role, description, source) => {
    if (!evidence.some((e) => e.role === role && e.description === description)) evidence.push({ role, description, source })
  }
  const refs = Object.entries(raw.references || {}).filter(([id]) => !/^(fx_|decal_|ps_|pop_)/.test(id))
  const entities = [[raw.id, raw.template || {}], ...refs]
  if (Number.isFinite(raw.computed_info?.damage_min)) add('直接输出', '基础攻击具有可读取伤害。', 'computed_info.damage_min')

  for (const [id, entity] of entities) {
    const attacks = [entity, entity.bullet, entity.area_attack, entity.dodge?.counter_attack, ...list(entity.attacks?.list), ...list(entity.melee?.attacks), ...list(entity.ranged?.attacks)].filter(Boolean)
    for (const a of attacks) {
      if (positive(a.damage_radius) || (a.type === 'area' && (positive(a.damage_max) || positive(a.damage_inc)))) {
        add('范围伤害', '攻击或技能具有范围伤害判定。', `${id}.damage_radius / area`)
      }
    }
    if (positive(entity.explosion_damage) && positive(entity.explosion_range)) add('范围伤害', '技能爆炸具有范围伤害判定。', id)
    const appliedMods = list(entity.aura?.mods).concat(entity.aura?.mod || [])
    if (positive(entity.aura?.radius) && (positive(entity.aura?.damage_inc) || positive(entity.aura?.damage_max) || appliedMods.some((name) => {
      const effect = raw.references?.[name]
      return effect && (positive(effect.damage_max) || Boolean(effect.dps))
    }))) add('范围伤害', '范围光环向敌人施加伤害效果。', id)
    if (hooks(entity).includes('aura_bullet_ignis_altar.update')) add('持续伤害', '火光祭坛落地光环在持续时间内反复造成伤害。', id)
    if (!entity.modifier) continue
    const scriptHooks = hooks(entity)
    let control = controlTypes[entity.modifier.type]
    // slow is also used by neutral/self effects; require an actual slowdown.
    if (entity.modifier.type === 'slow' && entity.slow && Object.keys(entity.slow).length &&
        !any(entity.slow.factor, (n) => n < 1) && !(entity.slow.factor_inc < 0)) control = undefined
    control ||= scriptHooks.map((hook) => controlScripts[hook]).find(Boolean)
    if (any(entity.slow?.factor, (n) => n < 1) || entity.slow?.factor_inc < 0) control ||= '减速'
    if (control) add('控制', `${control}效果。`, id)

    // A beam can use dps internally to deliver one shot. It is not a poison/burn.
    // Likewise, a summon losing its own HP is not damage over time to enemies.
    if (scriptHooks.includes('mod_dps.update') && entity.dps && !entity.dps.cocos_cycles &&
        (entity.modifier.duration > entity.dps.damage_every || (id === 'mod_tower_demon_pit_master_explosion_burning' && raw.template?.powers?.master_exploders?.burning_duration)) && id !== 'mod_soldier_rotten_forest_tree_lose_hp') {
      add('持续伤害', '附加效果在持续时间内多次造成伤害。', id)
    }
  }

  // Script-only behavior comes from the fingerprint-checked mechanics review.
  const reviewed = new Map((tower.mechanics?.items || []).map((m) => [m.id, m]))
  if (reviewed.has('shaolin-control')) add('控制', '少林僧众普攻在满足条件时打断敌人；详见实战机制。', 'shaolin-control')
  for (const id of ['shaolin-distribution', 'high-elven-volley', 'sunray-sharing', 'dwaarp-control', 'furnace-penetration', 'tesla-chain', 'frankenstein-chain']) {
    if (reviewed.has(id)) add('范围伤害', '已核实攻击可分配至多个敌人或逐个结算范围内敌人。', id)
  }

  if (raw.families?.includes('barrack') || tower.units?.length) add('召唤/拦截', '具有驻防或召唤单位；飞行单位不等同于地面阻挡。', 'units / barrack')

  // Economy/debuff rules are intentionally confined to actual power data and
  // effect fields, not words such as "gold", "curse" or "root" in names.
  for (const [id, power] of Object.entries(raw.template?.powers || {})) {
    if (['gold', 'gold_factor', 'gold_factor_inc', 'gold_extra', 'gold_extra_inc', 'steal_min', 'steal_max'].some((key) => positive(power[key]))) {
      add('经济辅助', '技能可增加金币收益。', `${raw.id}.powers.${id}`)
    }
  }
  for (const [id, entity] of refs) {
    if (positive(entity.extra_gold) || positive(entity.gold_extra) || positive(entity.gold_factor) || positive(entity.gold_min) || positive(entity.pickpocket?.steal_max) || positive(entity.gold_chance)) add('经济辅助', '攻击或效果可增加金币收益。', id)
    const scriptHooks = hooks(entity)
    if ((scriptHooks.includes('mod_damage.insert') && (entity.damage_type & (1024 | 2048)) && positive(entity.damage_max)) ||
        entity.armor_buff?.factor < 0) add('减益/破甲', '效果降低目标的物理护甲或魔法护甲。', id)
    if ((scriptHooks.includes('mod_damage_factors.insert') || scriptHooks.includes('mod_arrow_silver_mark.insert')) && (entity.inflicted_damage_factor < 1 || entity.received_damage_factor > 1)) {
      add('减益/破甲', '效果降低敌人输出或提高敌人受到的伤害。', id)
    }
    if (scriptHooks.includes('mod_arborean_emissary_weak.insert') &&
        (any(entity.received_damage_factor_config, (n) => n > 1) || any(entity.inflicted_damage_factor_config, (n) => n < 1))) {
      add('减益/破甲', '树灵标记提高目标受到的伤害。', id)
    }
  }
  for (const effect of supportIds.get(raw.id) || []) {
    if (effect.levels.some((l) => l.damageBonus || l.damagePerTrigger)) add('增伤辅助', '为受益防御塔提供伤害增益。', effect.id)
    if (effect.levels.some((l) => l.rangeBonus)) add('增距辅助', '为受益防御塔提供射程增益。', effect.id)
    if (effect.levels.some((l) => l.speedBonus)) add('攻速辅助', '为受益防御塔提供攻速增益。', effect.id)
  }
  const roles = [...new Set(evidence.map((e) => e.role))]
  if (roles.includes('直接输出') && roles.every((r) => ['直接输出', '范围伤害', '持续伤害'].includes(r))) {
    roles.unshift('纯输出')
    evidence.unshift({ role: '纯输出', description: '当前已识别能力以伤害为主，未识别到控制、召唤或辅助效果。', source: '已识别能力汇总' })
  }
  return { roles, roleEvidence: evidence }
}
