import { describe, expect, it } from 'vitest'
import { doveData } from '../data'
import { calculateBuffs } from './calculator'

const tower = doveData.towers.find((item) => item.id === 'tower_ranger')!

describe('Dove auxiliary buff calculator', () => {
  it('adds damage and speed bonuses while multiplying range', () => {
    const result = calculateBuffs(tower, doveData.supportEffects, [
      { effectId: 'crossbow-eagle', level: 3 },
      { effectId: 'high-elven-sentinel', level: 3 },
      { effectId: 'arcane-empowerment', level: 3 },
      { effectId: 'pirate-watcher', level: 3 },
    ])

    expect(result.damageBonus).toBe(0.625)
    expect(result.damageMin).toBe(21.125)
    expect(result.damageMax).toBe(32.5)
    expect(result.rangeMultiplier).toBe(1.43)
    expect(result.range).toBe(286)
    expect(result.speedBonus).toBe(0.4)
    expect(result.cooldown).toBeCloseTo(0.2786, 4)
  })

  it('caps Dark Elf triggers at the selected skill level', () => {
    const result = calculateBuffs(tower, doveData.supportEffects, [
      { effectId: 'dark-elf-hunt', level: 1, triggers: 999 },
    ])

    expect(result.applied[0]?.triggers).toBe(20)
    expect(result.damageBonus).toBe(0.16)
  })

  it('uses rally range for barracks', () => {
    const barrack = doveData.towers.find((item) => item.id === 'tower_paladin')!
    const result = calculateBuffs(barrack, doveData.supportEffects, [
      { effectId: 'pirate-watcher', level: 3 },
    ])

    expect(result.rangeLabel).toBe('集结范围')
    expect(result.range).toBe(208)
  })

  it('applies cumulative archer technology levels before support effects', () => {
    const result = calculateBuffs(
      tower,
      doveData.supportEffects,
      [{ effectId: 'high-elven-sentinel', level: 3 }],
      doveData.technologyTrees,
      {
        treeId: 1,
        levels: { archer: 5, barrack: 0, mage: 0, engineer: 0 },
      },
    )

    expect(result.price).toBe(219)
    expect(result.range).toBe(262.5)
    expect(result.expectedDpsMultiplier).toBe(1.1)
    expect(result.damageMin).toBeCloseTo(15.925, 3)
    expect(result.appliedTechnologies).toHaveLength(5)
  })

  it('applies engineer damage, range and rounded price technologies', () => {
    const bfg = doveData.towers.find((item) => item.id === 'tower_bfg')!
    const result = calculateBuffs(
      bfg,
      doveData.supportEffects,
      [],
      doveData.technologyTrees,
      {
        treeId: 1,
        levels: { archer: 0, barrack: 0, mage: 0, engineer: 3 },
      },
    )

    expect(result.damageMin).toBe(82.5)
    expect(result.damageMax).toBe(163.75)
    expect(result.range).toBe(209)
    expect(result.price).toBe(360)
  })

  it('uses the selected on-field mage tower count for Brilliance', () => {
    const arcane = doveData.towers.find((item) => item.id === 'tower_arcane_wizard')!
    const result = calculateBuffs(
      arcane,
      doveData.supportEffects,
      [],
      doveData.technologyTrees,
      {
        treeId: 1,
        levels: { archer: 0, barrack: 0, mage: 6, engineer: 0 },
        mageTowerCount: 3,
      },
    )

    expect(result.technologyDamageMultiplier).toBe(1.426)
    expect(result.damageMin).toBe(131.192)
    expect(result.damageMax).toBe(222.456)
    expect(result.range).toBe(230)
    expect(result.price).toBe(264)
  })

  it('applies barrack health, armor, rally and respawn technologies', () => {
    const paladin = doveData.towers.find((item) => item.id === 'tower_paladin')!
    const result = calculateBuffs(
      paladin,
      doveData.supportEffects,
      [],
      doveData.technologyTrees,
      {
        treeId: 1,
        levels: { archer: 0, barrack: 4, mage: 0, engineer: 0 },
      },
    )

    expect(result.range).toBe(192)
    expect(result.soldier).toMatchObject({
      count: 3,
      hp: 299.75,
      armor: 0.55,
      magicArmor: 0.45,
      respawn: 11.2,
    })
  })
})
