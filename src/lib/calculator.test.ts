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
})
