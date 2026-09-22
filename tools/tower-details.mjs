// Normalization of runtime templates. No game code or expressions run in the browser.
const finite = (value) => Number.isFinite(value) ? value : null
const list = (value) => Array.isArray(value) ? value : []

const parameterLabels = {
  cooldown: ['冷却', '秒'], duration: ['持续时间', '秒'], aura_duration: ['光环持续', '秒'],
  mod_duration: ['效果持续', '秒'], damage_min: ['伤害下限', ''], damage_max: ['伤害上限', ''],
  damage: ['伤害', ''], radius: ['作用半径', ''], range: ['范围', ''], range_config: ['作用范围', ''],
  count: ['数量', ''], max_targets: ['目标上限', ''], damage_factor: ['伤害倍率', '倍'],
  attack_range_factor: ['射程倍率', '倍'], heal: ['治疗量', ''], hp: ['生命', ''],
  slow_factor: ['移动速度倍率', '倍'], chance: ['触发概率', '%'],
}

export function buildPowerLevels(power, rawPower, resolved = {}) {
  let cumulativePrice = 0
  return Array.from({ length: power.maxLevel }, (_, index) => {
    const level = index + 1
    const exact = power.descriptions.find(({ key }) =>
      key.endsWith(`_DESCRIPTION_${level}`) || key.endsWith(`_${level}_DESCRIPTION`))
    const shared = power.descriptions.find(({ key }) =>
      !/_DESCRIPTION_\d+$|_\d+_DESCRIPTION$/.test(key))
    const description = exact || shared
    const resolvedDescription = description && resolved[description.key]
    const price = level === 1 ? power.priceBase : power.priceIncrement
    cumulativePrice = price === null || cumulativePrice === null ? null : cumulativePrice + price
    const parameters = []
    for (const [key, [label, unit]] of Object.entries(parameterLabels)) {
      const raw = rawPower[key]
      let value = finite(Array.isArray(raw) ? raw[index] : raw)
      // Game scripts use base + increment * purchased level for this pair.
      if (key === 'cooldown' && Number.isFinite(rawPower.cooldown_base) && Number.isFinite(rawPower.cooldown_inc)) {
        value = rawPower.cooldown_base + rawPower.cooldown_inc * level
      }
      if (value !== null) parameters.push({ label, value: unit === '%' ? value * 100 : value, unit })
    }
    return {
      level, price, cumulativePrice,
      description: resolvedDescription?.text || description?.text || '游戏未提供该级说明。',
      descriptionKey: description?.key || null,
      descriptionSource: exact ? 'level' : shared ? 'shared' : 'missing',
      unresolved: Boolean(resolvedDescription?.unresolved || /动态数值|%\$/.test(description?.text || '') && !resolvedDescription),
      parameters,
    }
  })
}

// Explicit mappings are necessary when spawning is done by script rather than a
// power.entity field. Growth rules below mirror tower_scripts.lua, not naming guesses.
const unitRules = {
  soldier_dragon: { tower: 'tower_shaolin', power: 'dragon', name: '神龙大侠', count: 1, growth: 'fixed' },
  soldier_elemental: { tower: 'tower_sorcerer', power: 'elemental', count: 1, growth: 'linear' },
  soldier_death_rider: { tower: 'tower_necromancer', power: 'rider', count: 1, growth: 'linear' },
  soldier_frankenstein: { tower: 'tower_frankenstein', power: 'frankie', count: 1, growth: 'frankie' },
}

// These units use random personal names in-game; give the encyclopedia a stable
// unit-type label rather than selecting one arbitrary soldier's personal name.
const unitNames = {
  soldier_footmen: '步兵', soldier_elf: '精灵战士', soldier_assassin: '刺客', soldier_templar: '圣殿骑士',
  soldier_dwarf: '矮人战士', soldier_amazona: '亚马逊战士', soldier_djinn: '灯神', soldier_pirate_flamer: '海盗喷火手',
  soldier_blade: '刀锋咏者', soldier_forest: '森林守护者', soldier_drow: '暮光复仇者', soldier_ewok: '埃渥克战士',
  soldier_druid_bear: '符文熊', soldier_tower_dark_elf: '黑暗精灵战士', soldier_deep_devils: '深海恶魔',
  soldier_deep_devils_chosen: '深海恶魔精英', soldier_balloon_goblin: '哥布林轰炸兵',
  soldier_elves_harasser: '暮光骚扰者', soldier_tower_ghost_lvl4: '幽冥战士',
  soldier_tower_rocket_gunners_lvl4: '火箭枪手', soldier_tower_dwarf_lvl4: '矮人火枪手',
  tower_paladin_covenant_soldier_lvl4: '圣骑士', soldier_priests_barrack: '祭司',
  soldier_abomination_priests_barrack: '憎恶', soldier_zombie: '僵尸', soldier_zombie_medium: '中型僵尸', soldier_zombie_big: '大型僵尸',
  soldier_tower_pandas_blue_lvl4: '蓝衣战士', soldier_tower_pandas_green_lvl4: '绿衣战士', soldier_tower_pandas_red_lvl4: '红衣战士',
}

function attacksFor(unit, references, formatDamageType) {
  const output = []
  for (const [component, label] of [['melee', '近战'], ['ranged', '远程'], ['attacks', '攻击']]) {
    const group = unit[component]
    for (const [index, attack] of list(group?.attacks || group?.list).entries()) {
      const projectile = references[attack.bullet]?.bullet
      const damage = projectile || attack
      output.push({
        id: `${component}-${index + 1}`, name: `${label}${index ? ` · 招式 ${index + 1}` : ''}`,
        damageMin: finite(damage.damage_min), damageMax: finite(damage.damage_max),
        damageType: formatDamageType(damage.damage_type), cooldown: finite(attack.cooldown),
        range: finite(attack.max_range > 0 ? attack.max_range : group.range),
        radius: finite(damage.damage_radius > 0 ? damage.damage_radius : null),
        targets: finite(attack.count > 0 ? attack.count : null),
        chance: finite(attack.chance), disabled: Boolean(attack.disabled),
        source: `${unit.template_name}.${component}.${group.attacks ? 'attacks' : 'list'}[${index + 1}]`,
      })
    }
  }
  return output
}

function unitStats(unit, attacks, respawns) {
  return {
    hp: finite(unit.health.hp_max), armor: finite(unit.health.armor), magicArmor: finite(unit.health.magic_armor),
    speed: finite(unit.motion?.max_speed), respawn: respawns ? finite(unit.health.dead_lifetime) : null,
    regen: finite(unit.regen?.health), regenCooldown: finite(unit.regen?.cooldown),
    lifetime: finite(unit.timed?.duration), attacks,
  }
}

export function buildTowerUnits(rawTower, powers, localization, sourceIndex, formatDamageType) {
  const references = rawTower.references || {}
  const barrack = rawTower.template?.barrack
  return Object.entries(references)
    .filter(([id, unit]) => unit.soldier && unit.health && rawTower.unit_candidates.includes(id))
    .map(([id, unit]) => {
      const rule = unitRules[id]?.tower === rawTower.id ? unitRules[id] : null
      const primary = barrack?.soldier_type === id
      const relatedPowers = powers.filter((power) =>
        power.id === rule?.power || JSON.stringify(rawTower.template.powers[power.id]).includes(`"${id}"`)
        || power.descriptions.some(({ key }) => (localization[key] || '').includes(`'${id}'`) || (localization[key] || '').includes(`"${id}"`)))
      const power = powers.find((item) => item.id === rule?.power)
      const attacks = attacksFor(unit, references, formatDamageType)
      const stats = unitStats(unit, attacks, primary)
      const variants = []
      if (rule && power) {
        for (let level = 1; level <= power.maxLevel; level++) {
          const variant = structuredClone(stats)
          if (rule.growth === 'linear') {
            variant.hp += (unit.health.hp_inc || 0) * level
            variant.armor += (unit.health.armor_inc || 0) * level
            const attack = variant.attacks.find((item) => item.id === 'melee-1')
            if (attack) {
              attack.damageMin += (unit.melee.attacks[0].damage_inc || 0) * level
              attack.damageMax += (unit.melee.attacks[0].damage_inc || 0) * level
            }
          } else if (rule.growth === 'frankie') {
            variant.armor = unit.health.armor_lvls[level - 1]
            const melee = unit.melee.attacks[0]
            const attack = variant.attacks.find((item) => item.id === 'melee-1')
            attack.damageMin = melee.damage_min_lvls[level - 1]
            attack.damageMax = melee.damage_max_lvls[level - 1]
            attack.cooldown = melee.cooldown_lvls[level - 1]
            variant.attacks.find((item) => item.id === 'melee-2').disabled = level < 3
          }
          variants.push({ level, label: `${power.name} ${level} 级`, ...variant })
        }
      }
      const nameKey = unit.info?.i18n_key ? `${unit.info.i18n_key}_NAME` : `${id.toUpperCase()}_NAME`
      return {
        id, name: rule?.name || localization[nameKey] || localization[`${id.toUpperCase()}_NAME`] || unitNames[id] || id,
        relatedPowerIds: relatedPowers.map((item) => item.id),
        count: rule?.count ?? (primary && rawTower.families.includes('barrack') ? finite(barrack.max_soldiers) : null),
        rallyRange: primary ? finite(barrack.rally_range) : null,
        controllable: primary,
        note: variants.length ? '按对应技能等级计算；未计科技、英雄或外部增益。' : '模板基准值，未代入技能升级；技能带来的属性变化见逐级说明。',
        stats, variants,
        source: sourceIndex.get(id) || null,
        scriptSource: rule ? 'kr1/tower_scripts.lua' : null,
      }
    }).sort((a, b) => a.id.localeCompare(b.id))
}
