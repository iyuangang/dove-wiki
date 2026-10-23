import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { validateContract, validateDatasetScores } from './sync-rating-contract.mjs'
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const contract = await json('../src/data/rating-contract.json')
describe('发布数据的统一评分定义', () => {
  for (const profile of ['standard', 'quick']) it(profile + ' 全部原版对象与共享权重、等级及公式一致', async () => {
    const data = await json('../public/rating/' + profile + '/results.json')
    expect(() => validateDatasetScores(data, contract)).not.toThrow()
    const changed = structuredClone(data)
    const row = changed.objects.find(r => r.state === 'complete')
    row.scores.single.value += .1
    expect(() => validateDatasetScores(changed, contract)).toThrow('分数与评分定义不同')
  })
  it('缺失指标、非法权重和未知公式不能成为发布定义', () => {
    const c = structuredClone(contract);c.axisOrders.hero.pop()
    expect(() => validateContract(c)).toThrow('八维指标')
    const d = structuredClone(contract);d.weights.hero.output.single = .9
    expect(() => validateContract(d)).toThrow('评分权重')
    const e = structuredClone(contract);e.formula.anchor = 80
    expect(() => validateContract(e)).toThrow('公式不支持')
  })
})
