import { describe, expect, it } from 'vitest'
import {
  calculateDamageProtection,
  damageTypeFromGame,
  simulateAttackSequence,
  simulateDamage,
} from './damage-simulator'

describe('Dove damage simulator', () => {
  it('applies true damage directly to the configurable dummy', () => {
    const result = simulateDamage({
      damageType: 'true',
      damage: 100,
      hp: 1000,
      armor: 10,
      magicArmor: 10,
    })

    expect(result.protection).toBe(0)
    expect(result.damageApplied).toBe(100)
    expect(result.hpLost).toBe(100)
    expect(result.remainingHp).toBe(900)
  })

  it('uses armor and magic armor for physical and magical damage', () => {
    expect(
      simulateDamage({
        damageType: 'physical',
        damage: 100,
        hp: 1000,
        armor: 10,
        magicArmor: 70,
      }).damageApplied,
    ).toBe(90)
    expect(
      simulateDamage({
        damageType: 'magical',
        damage: 100,
        hp: 1000,
        armor: 70,
        magicArmor: 10,
      }).damageApplied,
    ).toBe(90)
  })

  it('matches Dove special damage protection curves', () => {
    expect(calculateDamageProtection('explosion', 50, 0)).toBe(0.25)
    expect(calculateDamageProtection('magical-explosion', 0, 50)).toBe(0.25)
    expect(calculateDamageProtection('electrical', 50, 0)).toBe(0.25)
    expect(calculateDamageProtection('shot', 50, 0)).toBe(0.35)
    expect(calculateDamageProtection('stab', 50, 0)).toBe(0.75)
    expect(calculateDamageProtection('mixed', 50, 20)).toBe(0.35)
    expect(calculateDamageProtection('mixed', 20, 50)).toBe(0.2)
  })

  it('provides the normalized endpoints shown by the damage curve chart', () => {
    const damageTypes = [
      'true',
      'physical',
      'magical',
      'explosion',
      'magical-explosion',
      'electrical',
      'shot',
      'rude',
      'stab',
      'mixed',
    ] as const
    const atMaximumDefense = Object.fromEntries(
      damageTypes.map((damageType) => [
        damageType,
        Math.round(
          simulateDamage({
            damageType,
            damage: 100,
            hp: 10_000,
            armor: 100,
            magicArmor: 100,
          }).damageApplied * 1000,
        ) / 1000,
      ]),
    )

    expect(atMaximumDefense).toEqual({
      true: 100,
      physical: 0,
      magical: 0,
      explosion: 40,
      'magical-explosion': 40,
      electrical: 50,
      shot: 30,
      rude: 40,
      stab: 0,
      mixed: 0,
    })
    expect(
      simulateDamage({
        damageType: 'stab',
        damage: 100,
        hp: 10_000,
        armor: 0,
        magicArmor: 0,
      }).damageApplied,
    ).toBe(200)
  })

  it('doubles stab base damage before applying protection', () => {
    const result = simulateDamage({
      damageType: 'stab',
      damage: 100,
      hp: 1000,
      armor: 10,
      magicArmor: 10,
    })

    expect(result.typeAdjustedDamage).toBe(200)
    expect(result.protection).toBeCloseTo(0.19)
    expect(result.damageApplied).toBeCloseTo(162)
  })

  it('separates calculated damage from capped HP loss on lethal hits', () => {
    const result = simulateDamage({
      damageType: 'true',
      damage: 100,
      hp: 40,
      armor: 0,
      magicArmor: 0,
    })

    expect(result.damageApplied).toBe(100)
    expect(result.hpLost).toBe(40)
    expect(result.remainingHp).toBe(0)
    expect(result.overkill).toBe(60)
  })

  it('maps Dove damage flags even when modifier bits are combined', () => {
    expect(damageTypeFromGame(1, '真实')).toBe('true')
    expect(damageTypeFromGame(33554434, '物理')).toBe('physical')
    expect(damageTypeFromGame(268435472, '电击')).toBe('electrical')
    expect(damageTypeFromGame(33554496, '枪伤')).toBe('shot')
    expect(damageTypeFromGame(null, '物理范围')).toBe('explosion')
  })

  it('rolls every attack inside the live range until the dummy is defeated', () => {
    const result = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 13,
      damageMax: 20,
      hp: 100,
      armor: 10,
      magicArmor: 10,
      seed: 2058,
    })

    expect(result.defeated).toBe(true)
    expect(result.attacks.length).toBeGreaterThan(0)
    expect(result.attacks.every((attack) => attack.rolledDamage >= 13)).toBe(true)
    expect(result.attacks.every((attack) => attack.rolledDamage <= 20)).toBe(true)
    expect(result.attacks.at(-1)?.remainingHp).toBe(0)
    expect(result.attacks.at(-1)?.hpLost).toBeLessThanOrEqual(
      result.attacks.at(-1)?.damageApplied || 0,
    )
  })

  it('produces a stable sequence for the same seed and changes after rerolling', () => {
    const input = {
      damageType: 'true' as const,
      damageMin: 10,
      damageMax: 20,
      hp: 100,
      armor: 0,
      magicArmor: 0,
    }
    const first = simulateAttackSequence({ ...input, seed: 1 })
    const repeated = simulateAttackSequence({ ...input, seed: 1 })
    const rerolled = simulateAttackSequence({ ...input, seed: 2 })

    expect(repeated.attacks.map((attack) => attack.rolledDamage)).toEqual(
      first.attacks.map((attack) => attack.rolledDamage),
    )
    expect(rerolled.attacks.map((attack) => attack.rolledDamage)).not.toEqual(
      first.attacks.map((attack) => attack.rolledDamage),
    )
  })

  it('stops safely when armor reduces every hit to zero', () => {
    const result = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 10,
      damageMax: 20,
      hp: 100,
      armor: 100,
      magicArmor: 0,
    })

    expect(result.defeated).toBe(false)
    expect(result.attacks).toHaveLength(0)
    expect(result.remainingHp).toBe(100)
  })

  it('keeps simulating after a zero roll when the range can still deal damage', () => {
    const result = simulateAttackSequence({
      damageType: 'true',
      damageMin: 0,
      damageMax: 1,
      hp: 1,
      armor: 0,
      magicArmor: 0,
      seed: 1,
      maxAttacks: 10,
    })

    expect(result.attacks[0]?.rolledDamage).toBe(0)
    expect(result.defeated).toBe(true)
    expect(result.attacks.length).toBeGreaterThan(1)
  })

  it('applies armor ignore before protection and doubles precision hits', () => {
    const result = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 30,
      magicArmor: 0,
      armorIgnore: 10,
      criticalChance: 1,
      criticalMultiplier: 2,
      seed: 2058,
    })

    expect(result.armorIgnored).toBe(10)
    expect(result.attacks[0]).toMatchObject({
      rolledDamage: 100,
      critical: true,
      technologyDamageMultiplier: 2,
      effectiveArmor: 20,
      damageApplied: 160,
    })
    expect(result.criticalHits).toBe(result.attacks.length)
  })

  it('rolls precision independently at the configured ten-percent chance', () => {
    const result = simulateAttackSequence({
      damageType: 'true',
      damageMin: 10,
      damageMax: 10,
      hp: 100_000,
      armor: 0,
      magicArmor: 0,
      criticalChance: 0.1,
      criticalMultiplier: 2,
      seed: 2058,
      maxAttacks: 100,
    })

    expect(result.attacks).toHaveLength(100)
    expect(result.criticalHits).toBeGreaterThan(0)
    expect(result.criticalHits).toBeLessThan(100)
    expect(result.attacks.filter((attack) => attack.critical)).toHaveLength(result.criticalHits)
    expect(
      result.attacks.every(
        (attack) => attack.damageApplied === (attack.critical ? 20 : 10),
      ),
    ).toBe(true)
  })

  it('uses the live attack interval to report total kill time', () => {
    const result = simulateAttackSequence({
      damageType: 'true',
      damageMin: 10,
      damageMax: 10,
      hp: 30,
      armor: 0,
      magicArmor: 0,
      attackInterval: 0.5,
    })

    expect(result.attacks.map((attack) => attack.timestamp)).toEqual([0, 0.5, 1])
    expect(result.elapsedTime).toBe(1)
    expect(result.finalBlow).toBe('attack')
  })

  it('reduces armor after each hit for Tear and Arcane Shatter style effects', () => {
    const result = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 100,
      damageMax: 100,
      hp: 10_000,
      armor: 30,
      magicArmor: 0,
      armorReductionPerHit: 10,
      maxAttacks: 3,
    })

    expect(result.attacks.map((attack) => attack.damageApplied)).toEqual([70, 80, 90])
    expect(result.attacks.map((attack) => attack.armorAfter)).toEqual([20, 10, 0])
    expect(result.finalArmor).toBe(0)
  })

  it('applies low-protection and unprotected damage multipliers', () => {
    const lowArmor = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 10,
      magicArmor: 0,
      lowProtectionThreshold: 0.1,
      lowProtectionMultiplier: 1.27,
      maxAttacks: 1,
    })
    const unprotected = simulateAttackSequence({
      damageType: 'magical',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 0,
      magicArmor: 0,
      unprotectedMultiplier: 1.2,
      maxAttacks: 1,
    })

    expect(lowArmor.attacks[0]?.damageApplied).toBeCloseTo(114.3)
    expect(unprotected.attacks[0]?.damageApplied).toBe(120)
  })

  it('models Unsteady as double unmitigated damage', () => {
    const result = simulateAttackSequence({
      damageType: 'magical',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 0,
      magicArmor: 50,
      unsteadyChance: 1,
      unsteadyMultiplier: 2,
      maxAttacks: 1,
    })

    expect(result.attacks[0]?.unsteady).toBe(true)
    expect(result.attacks[0]?.damageApplied).toBe(200)
    expect(result.unsteadyHits).toBe(1)
  })

  it('adds enchanted magical damage after the primary hit', () => {
    const result = simulateAttackSequence({
      damageType: 'physical',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 0,
      magicArmor: 50,
      secondaryMagicDamageFactor: 0.12,
      maxAttacks: 1,
    })

    expect(result.attacks[0]?.damageApplied).toBe(100)
    expect(result.attacks[0]?.secondaryDamageApplied).toBe(6)
    expect(result.attacks[0]?.totalAttackDamageApplied).toBe(106)
  })

  it('calculates Magic Dust from rolled damage and the dummy maximum HP', () => {
    const result = simulateAttackSequence({
      damageType: 'true',
      damageMin: 100,
      damageMax: 100,
      hp: 1000,
      armor: 0,
      magicArmor: 0,
      magicDustChance: 1,
      magicDustHpFactor: 0.004,
      maxAttacks: 1,
    })

    expect(result.attacks[0]?.magicDust).toBe(true)
    expect(result.attacks[0]?.damageApplied).toBeCloseTo(140.1995, 4)
    expect(result.magicDustHits).toBe(1)
  })

  it('continues scheduled bleed ticks and records a bleed finishing blow', () => {
    const result = simulateAttackSequence({
      damageType: 'true',
      damageMin: 10,
      damageMax: 10,
      hp: 20,
      armor: 0,
      magicArmor: 0,
      attackInterval: 10,
      bleedChance: 1,
      bleedDamageFactor: 0.1,
      bleedTicks: 23,
      bleedTickInterval: 4 / 30,
      bleedDuration: 3,
    })

    expect(result.attacks).toHaveLength(1)
    expect(result.attacks[0]?.bleed).toBe(true)
    expect(result.defeated).toBe(true)
    expect(result.finalBlow).toBe('bleed')
    expect(result.elapsedTime).toBeCloseTo(1.2)
  })
})
