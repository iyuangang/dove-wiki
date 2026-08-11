import type {
  SupportEffect,
  TechnologyModifier,
  TechnologyTree,
  Tower,
  TowerFamily,
} from '../types'

export interface SupportSelection {
  effectId: string
  level: number
  triggers?: number
}

export interface TechnologySelection {
  treeId: number
  levels: Record<TowerFamily, number>
  mageTowerCount?: number
}

export interface BuffResult {
  damageMin: number | null
  damageMax: number | null
  range: number | null
  rangeLabel: '攻击范围' | '集结范围'
  cooldown: number | null
  dps: number | null
  price: number | null
  soldier: {
    count: number | null
    hp: number | null
    armor: number | null
    magicArmor: number | null
    respawn: number | null
  } | null
  damageBonus: number
  technologyDamageMultiplier: number
  rangeMultiplier: number
  technologyRangeMultiplier: number
  speedBonus: number
  technologyCooldownMultiplier: number
  expectedDpsMultiplier: number
  applied: Array<{
    effectId: string
    name: string
    level: number
    radius: number
    damageBonus: number
    rangeBonus: number
    speedBonus: number
    triggers: number | null
    mode: SupportEffect['mode']
  }>
  appliedTechnologies: Array<{
    technologyId: string
    name: string
    family: TowerFamily
    level: number
    description: string
    calculated: boolean
  }>
  warning: string | null
}

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function modifierAppliesToTower(modifier: TechnologyModifier, towerId: string) {
  if (modifier.includeTowerIds && !modifier.includeTowerIds.includes(towerId)) return false
  if (modifier.excludeTowerIds?.includes(towerId)) return false
  return true
}

function multiply(value: number | null, factor: number) {
  return value === null ? null : value * factor
}

function add(value: number | null, amount: number) {
  return value === null ? null : value + amount
}

export function calculateBuffs(
  tower: Tower,
  effects: SupportEffect[],
  selections: SupportSelection[],
  technologyTrees: TechnologyTree[] = [],
  technologySelection?: TechnologySelection,
): BuffResult {
  const effectById = new Map(effects.map((effect) => [effect.id, effect]))
  let damageBonus = 0
  let rangeMultiplier = 1
  let speedBonus = 0
  const applied: BuffResult['applied'] = []

  if (tower.canBeBuffed) {
    for (const selection of selections) {
      const effect = effectById.get(selection.effectId)
      const level = effect?.levels.find((candidate) => candidate.level === selection.level)
      if (!effect || !level) continue

      let selectedDamageBonus = level.damageBonus || 0
      let triggers: number | null = null
      if (level.damagePerTrigger) {
        const requested = Math.max(0, Math.floor(selection.triggers || 0))
        triggers = Math.min(requested, level.triggerCap ?? requested)
        selectedDamageBonus += level.damagePerTrigger * triggers
      }

      damageBonus += selectedDamageBonus
      rangeMultiplier *= 1 + (level.rangeBonus || 0)
      speedBonus += level.speedBonus || 0
      applied.push({
        effectId: effect.id,
        name: effect.name,
        level: level.level,
        radius: level.radius,
        damageBonus: selectedDamageBonus,
        rangeBonus: level.rangeBonus || 0,
        speedBonus: level.speedBonus || 0,
        triggers,
        mode: effect.mode,
      })
    }
  }

  let technologyDamageMin = tower.attack.damageMin
  let technologyDamageMax = tower.attack.damageMax
  let technologyRangeMultiplier = 1
  let technologyRallyRangeMultiplier = 1
  let technologyCooldownMultiplier = 1
  let expectedDpsMultiplier = 1
  let price = tower.price
  let soldier = tower.soldier ? { ...tower.soldier } : null
  const appliedTechnologies: BuffResult['appliedTechnologies'] = []
  const selectedTree = technologyTrees.find(
    (tree) => tree.id === technologySelection?.treeId,
  )

  if (selectedTree && technologySelection) {
    const technologies = selectedTree.technologies.filter(
      (technology) =>
        tower.families.includes(technology.family) &&
        technology.level <= (technologySelection.levels[technology.family] || 0),
    )

    for (const technology of technologies) {
      const modifiers = technology.modifiers.filter((modifier) =>
        modifierAppliesToTower(modifier, tower.id),
      )

      for (const modifier of modifiers) {
        if (modifier.operation === 'table') {
          const values = modifier.values || []
          if (!values.length) continue
          const requestedCount = Math.max(
            1,
            Math.floor(technologySelection.mageTowerCount || 1),
          )
          const factor = values[Math.min(requestedCount, values.length) - 1]
          if (
            modifier.metric === 'damage' &&
            typeof factor === 'number' &&
            Number.isFinite(factor)
          ) {
            technologyDamageMin = multiply(technologyDamageMin, factor)
            technologyDamageMax = multiply(technologyDamageMax, factor)
          }
          continue
        }

        const value = modifier.value
        if (typeof value !== 'number' || !Number.isFinite(value)) continue

        if (modifier.metric === 'damage') {
          if (modifier.operation === 'average') {
            if (technologyDamageMin !== null && technologyDamageMax !== null) {
              const average = ((technologyDamageMin + technologyDamageMax) / 2) * value
              technologyDamageMin = average
              technologyDamageMax = average
            }
          } else if (modifier.operation === 'multiply') {
            technologyDamageMin = multiply(technologyDamageMin, value)
            technologyDamageMax = multiply(technologyDamageMax, value)
          }
        } else if (modifier.metric === 'expectedDps' && modifier.operation === 'multiply') {
          expectedDpsMultiplier *= value
        } else if (modifier.metric === 'range' && modifier.operation === 'multiply') {
          technologyRangeMultiplier *= value
        } else if (modifier.metric === 'rallyRange' && modifier.operation === 'multiply') {
          technologyRallyRangeMultiplier *= value
        } else if (modifier.metric === 'cooldown' && modifier.operation === 'multiply') {
          technologyCooldownMultiplier *= value
        } else if (modifier.metric === 'price' && modifier.operation === 'multiply') {
          if (price !== null) {
            const nextPrice = price * value
            price = modifier.rounding === 'floor' ? Math.floor(nextPrice) : Math.ceil(nextPrice)
          }
        } else if (modifier.metric === 'soldierHp' && modifier.operation === 'multiply') {
          if (soldier) soldier.hp = multiply(soldier.hp, value)
        } else if (modifier.metric === 'soldierArmor' && modifier.operation === 'add') {
          if (soldier) soldier.armor = add(soldier.armor, value)
        } else if (modifier.metric === 'soldierMagicArmor' && modifier.operation === 'add') {
          if (soldier) soldier.magicArmor = add(soldier.magicArmor, value)
        } else if (modifier.metric === 'respawn' && modifier.operation === 'multiply') {
          if (soldier) soldier.respawn = multiply(soldier.respawn, value)
        } else if (modifier.metric === 'soldierCount' && modifier.operation === 'add') {
          if (soldier) soldier.count = add(soldier.count, value)
        }
      }

      appliedTechnologies.push({
        technologyId: technology.id,
        name: technology.name,
        family: technology.family,
        level: technology.level,
        description: technology.description,
        calculated: modifiers.length > 0,
      })
    }
  }

  const baseRange = tower.attack.range ?? tower.attack.rallyRange
  const activeTechnologyRangeMultiplier =
    tower.attack.range === null
      ? technologyRallyRangeMultiplier
      : technologyRangeMultiplier
  const damageMin =
    technologyDamageMin === null
      ? null
      : round(technologyDamageMin * (1 + damageBonus))
  const damageMax =
    technologyDamageMax === null
      ? null
      : round(technologyDamageMax * (1 + damageBonus))
  const cooldown =
    tower.attack.cooldown === null
      ? null
      : round(
          (tower.attack.cooldown * technologyCooldownMultiplier) /
            (1 + speedBonus),
        )
  const dps =
    damageMin !== null && damageMax !== null && cooldown
      ? round(((damageMin + damageMax) / 2 / cooldown) * expectedDpsMultiplier)
      : null
  const baseDamageAverage =
    tower.attack.damageMin !== null && tower.attack.damageMax !== null
      ? (tower.attack.damageMin + tower.attack.damageMax) / 2
      : null
  const technologyDamageAverage =
    technologyDamageMin !== null && technologyDamageMax !== null
      ? (technologyDamageMin + technologyDamageMax) / 2
      : null

  if (soldier) {
    soldier = {
      count: soldier.count === null ? null : round(soldier.count),
      hp: soldier.hp === null ? null : round(soldier.hp),
      armor: soldier.armor === null ? null : round(soldier.armor),
      magicArmor:
        soldier.magicArmor === null ? null : round(soldier.magicArmor),
      respawn: soldier.respawn === null ? null : round(soldier.respawn),
    }
  }

  return {
    damageMin,
    damageMax,
    range:
      baseRange === null
        ? null
        : round(baseRange * activeTechnologyRangeMultiplier * rangeMultiplier),
    rangeLabel: tower.attack.range === null ? '集结范围' : '攻击范围',
    cooldown,
    dps,
    price,
    soldier,
    damageBonus: round(damageBonus),
    technologyDamageMultiplier:
      baseDamageAverage && technologyDamageAverage
        ? round(technologyDamageAverage / baseDamageAverage)
        : 1,
    rangeMultiplier: round(rangeMultiplier),
    technologyRangeMultiplier: round(activeTechnologyRangeMultiplier),
    speedBonus: round(speedBonus),
    technologyCooldownMultiplier: round(technologyCooldownMultiplier),
    expectedDpsMultiplier: round(expectedDpsMultiplier),
    applied,
    appliedTechnologies,
    warning: tower.canBeBuffed
      ? null
      : '该塔的 tower.can_be_mod 为 false，标准辅助效果不会生效；科技仍按塔族规则计算。',
  }
}

export function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatPercent(value: number, digits = 1) {
  return `${formatNumber(value * 100, digits)}%`
}
