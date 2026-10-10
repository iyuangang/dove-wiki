import rawData from '../data/dove-data.json'
import type { CalculationRules, Tower } from '../types'
import type { BuffResult } from './calculator'
import type { AttackSequenceInput } from './damage-simulator'

export const calculationRules = rawData.calculationRules as CalculationRules

export function purgeDamageBonus(count: number, rules = calculationRules): number {
  if (!rules.valid) return 0
  const p = rules.parameters
  const boundedCount = Math.min(p.purgeEnemyCap, Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)))
  return p.purgeBase + boundedCount * p.purgePerEnemy
}

export interface SimulationTechnologyEffect {
  id: string
  name: string
  description: string
  active: boolean
}

export function buildSimulationTechnologies(
  tower: Tower,
  result: BuffResult,
  flying: boolean,
  nearbyEnemies: number,
  rules = calculationRules,
) {
  const ids = new Set(rules.valid ? result.appliedTechnologies.map((technology) => technology.technologyId) : [])
  const has = (id: string) => ids.has(id)
  const p = rules.parameters
  const effects: SimulationTechnologyEffect[] = []
  const input: Partial<AttackSequenceInput> = {}
  const pct = (value: number) => `${Math.round(value * 10000) / 100}%`
  const add = (id: string, description: string, active = true) => {
    if (has(id)) effects.push({ id, name: result.appliedTechnologies.find((technology) => technology.technologyId === id)!.name, description, active })
  }
  if (has('archer_piercing')) {
    input.armorIgnore = p.piercingArmor
    add('archer_piercing', `每次攻击忽略目标 ${p.piercingArmor} 点护甲`)
  }
  if (has('archer_precision')) {
    input.criticalChance = p.criticalChance
    input.criticalMultiplier = p.criticalMultiplier
    add('archer_precision', `${pct(p.criticalChance)} 概率造成 ${p.criticalMultiplier} 倍伤害`)
  }
  if (has('archer_tear')) {
    const average = ((result.technologyDamageMin || 0) + (result.technologyDamageMax || 0)) / 2
    const tier = p.tearThresholds.filter((threshold) => average > threshold).length
    input.armorReductionPerHit = p.tearReductions[tier]
    add('archer_tear', `每次命中后永久降低 ${input.armorReductionPerHit} 点护甲`)
  }
  if (has('mage_arcane_shatter')) {
    // ray_arcane always takes the normal modifier, even below the threshold.
    input.armorReductionPerHit = tower.id === 'tower_arcane_wizard' || (result.technologyDamageMax || 0) >= p.shatterThreshold ? p.shatterNormal : p.shatterSmall
    add('mage_arcane_shatter', `每次命中后永久降低 ${input.armorReductionPerHit} 点护甲`)
  }
  if (has('archer_obsidian')) {
    input.lowProtectionThreshold = p.lowProtectionThreshold
    input.lowProtectionMultiplier = p.lowProtectionMultiplier
    add('archer_obsidian', `当前减伤不高于 ${pct(p.lowProtectionThreshold)} 时，主伤害提高 ${pct(p.lowProtectionMultiplier - 1)}`)
  }
  if (has('archer_magic')) {
    input.secondaryMagicDamageFactor = p.secondaryMagicDamageFactor
    add('archer_magic', `追加主伤害 ${pct(p.secondaryMagicDamageFactor)} 的魔法伤害，向上取整且至少为 1`)
  }
  if (has('archer_fly_killer')) {
    input.flyingDamageMultiplier = flying ? p.flyingDamageMultiplier : 1
    add('archer_fly_killer', `对空额外提高 ${pct(p.flyingDamageMultiplier - 1)}；${flying ? '当前生效' : '当前目标为地面单位'}`, flying)
  }
  if (has('mage_strike')) {
    input.unprotectedMultiplier = p.unprotectedMultiplier
    add('mage_strike', `目标对本次伤害没有减伤时，主伤害提高 ${pct(p.unprotectedMultiplier - 1)}`)
  }
  if (has('mage_unsteady')) {
    input.unsteadyChance = p.unsteadyChance
    input.unsteadyMultiplier = p.unsteadyMultiplier
    add('mage_unsteady', `${pct(p.unsteadyChance)} 概率造成 ${p.unsteadyMultiplier} 倍无减伤伤害`)
  }
  if (has('mage_purge_field')) add('mage_purge_field', `射程内 ${nearbyEnemies} 名敌人：伤害加法增益 ${pct(purgeDamageBonus(nearbyEnemies, rules))}，已计入面板`)
  const compensation = has('engineer_magic_dust') && rules.magicDustCompensationTowerIds.includes(tower.id)
  if (has('engineer_magic_dust')) {
    input.magicDustChance = compensation ? 0 : p.magicDustChance
    input.magicDustHpFactor = p.magicDustHpFactor
    add('engineer_magic_dust', compensation
      ? `兼容补偿：固定提高 ${pct(p.magicDustCompensation - 1)}，已计入面板`
      : `${pct(p.magicDustChance)} 概率追加 最大生命 × ${p.magicDustHpFactor} × √(本击伤害 + 1)`)
  }
  if (has('archer_el_bloodletting_shoot')) {
    Object.assign(input, { bleedChance: p.bleedChance, bleedDamageFactor: p.bleedDamageFactor, bleedTicks: p.bleedTicks, bleedTickInterval: p.bleedTickInterval, bleedDuration: p.bleedDuration, bleedMaxStacks: p.bleedMaxStacks })
    add('archer_el_bloodletting_shoot', `${pct(p.bleedChance)} 概率施加 ${p.bleedDuration} 秒放血，共 ${p.bleedTicks} 跳，最多 ${p.bleedMaxStacks} 层`)
  }
  return { input, effects, magicDustUsesCompensation: compensation }
}
