import { describe, expect, it } from 'vitest'
import { shaolinVolley } from './shaolin'

describe('少林寺整轮攻击分配', () => {
  it('基础三人围攻单体不衰减，六人从第四击开始衰减', () => {
    expect(shaolinVolley(3, 1, 20, 25)).toMatchObject({ min: 60, max: 75 })
    const result = shaolinVolley(6, 1, 20, 25)
    expect(result.hits.map((hit) => hit.factor)).toEqual([1, 1, 1, 1 / Math.sqrt(2), 1 / Math.sqrt(3), 0.5])
    expect(result.min).toBeCloseTo(95.6891406)
    expect(result.max).toBeCloseTo(119.6114258)
  })
  it('六人对两名目标各打三次，不错误应用单目标衰减', () => {
    const result = shaolinVolley(6, 2, 20, 25)
    expect(result.hits.map((hit) => hit.target)).toEqual([1, 2, 1, 2, 1, 2])
    expect(result.hits.every((hit) => hit.factor === 1)).toBe(true)
    expect(result).toMatchObject({ min: 120, max: 150 })
  })
  it('跨轮不积累衰减，多余目标不凭空增加攻击', () => {
    expect(shaolinVolley(6, 1, 20, 25)).toEqual(shaolinVolley(6, 1, 20, 25))
    expect(shaolinVolley(6, 99, 20, 25)).toEqual(shaolinVolley(6, 6, 20, 25))
    expect(() => shaolinVolley(6, 0, 20, 25)).toThrow(RangeError)
  })
})
