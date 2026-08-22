import { describe, expect, it } from 'vitest'
import { calculateDamageProtection, simulateDamage } from './damage-simulator'

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
})
