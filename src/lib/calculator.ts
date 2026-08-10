import type { SupportEffect, Tower } from '../types'

export interface SupportSelection {
  effectId: string
  level: number
  triggers?: number
}

export interface BuffResult {
  damageMin: number | null
  damageMax: number | null
  range: number | null
  rangeLabel: '攻击范围' | '集结范围'
  cooldown: number | null
  dps: number | null
  damageBonus: number
  rangeMultiplier: number
  speedBonus: number
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
  warning: string | null
}

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateBuffs(
  tower: Tower,
  effects: SupportEffect[],
  selections: SupportSelection[],
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

  const baseRange = tower.attack.range ?? tower.attack.rallyRange
  const damageMin =
    tower.attack.damageMin === null
      ? null
      : round(tower.attack.damageMin * (1 + damageBonus))
  const damageMax =
    tower.attack.damageMax === null
      ? null
      : round(tower.attack.damageMax * (1 + damageBonus))
  const cooldown =
    tower.attack.cooldown === null
      ? null
      : round(tower.attack.cooldown / (1 + speedBonus))
  const dps =
    damageMin !== null && damageMax !== null && cooldown
      ? round((damageMin + damageMax) / 2 / cooldown)
      : null

  return {
    damageMin,
    damageMax,
    range: baseRange === null ? null : round(baseRange * rangeMultiplier),
    rangeLabel: tower.attack.range === null ? '集结范围' : '攻击范围',
    cooldown,
    dps,
    damageBonus: round(damageBonus),
    rangeMultiplier: round(rangeMultiplier),
    speedBonus: round(speedBonus),
    applied,
    warning: tower.canBeBuffed ? null : '该塔的 tower.can_be_mod 为 false，标准辅助效果不会生效。',
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
