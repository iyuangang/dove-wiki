import { describe, expect, it } from 'vitest'
import { createGameRelease, updateGameChangelog } from './game-changelog.mjs'

function data(version, commitHash, overrides = {}) {
  return {
    metadata: {
      gameVersion: version,
      contentVersion: '5.6.12',
      commitHash,
      generatedAt: '2026-08-22T00:00:00.000Z',
    },
    heroes: [],
    towers: [],
    enemies: [],
    technologyTrees: [],
    ...overrides,
  }
}

function tower(range, skillPrice, skillDescription) {
  return {
    id: 'tower_test',
    name: '测试塔',
    description: '测试说明',
    image: '/portraits/tower_test.png',
    roles: ['纯输出'],
    price: 100,
    attack: {
      damageMin: 10,
      damageMax: 20,
      cooldown: 1,
      range,
      rallyRange: null,
    },
    soldier: null,
    powers: [
      {
        id: 'power',
        name: '测试技能',
        maxLevel: 1,
        priceBase: skillPrice,
        priceIncrement: 0,
        descriptions: [{ text: skillDescription }],
      },
    ],
  }
}

describe('游戏更新差异生成', () => {
  it('识别新增英雄、防御塔数值与技能说明变化', () => {
    const previous = data('1.0.0', 'old', { towers: [tower(100, 100, '旧说明')] })
    const current = data('1.0.1', 'new', {
      heroes: [
        {
          id: 'hero_new',
          name: '新英雄',
          thumbnail: '/heroes/thumbs/hero_new.png',
          abilities: [{ name: '能力', description: '能力说明' }],
        },
      ],
      towers: [tower(125, 120, '新说明')],
    })

    const release = createGameRelease(previous, current)

    expect(release.version).toBe('1.0.1')
    expect(release.summary.changeCount).toBe(3)
    expect(release.changes).toContainEqual(
      expect.objectContaining({ category: 'hero', kind: 'added', entityName: '新英雄' }),
    )
    expect(release.changes.find((change) => change.kind === 'balance')?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: '攻击范围', before: '100', after: '125' }),
        expect.objectContaining({ field: '测试技能 · 基础价格', before: '100', after: '120' }),
      ]),
    )
    expect(release.changes.find((change) => change.kind === 'content')?.details).toContainEqual(
      expect.objectContaining({ field: '测试技能 · 技能说明', before: '旧说明', after: '新说明' }),
    )
  })

  it('按游戏提交去重，重复同步不会新增记录', () => {
    const previous = data('1.0.0', 'old')
    const current = data('1.0.1', 'new')
    const first = updateGameChangelog(previous, current)
    const second = updateGameChangelog(previous, current, first)

    expect(first.releases).toHaveLength(1)
    expect(second).toEqual(first)
  })

  it('升级详情格式时不把动态说明展开记为游戏调整，仍保留价格变化', () => {
    const before = tower(100, 100, '造成动态数值点伤害')
    const after = tower(100, 120, '造成30点伤害')
    after.powers[0].levels = [{ level: 1, description: '造成30点伤害' }]
    const release = createGameRelease(data('1', 'a', { towers: [before] }), data('2', 'b', { towers: [after] }))
    expect(release.changes.map((change) => change.kind)).toEqual(['balance'])
    const later = structuredClone(after)
    later.powers[0].descriptions[0].text = '造成40点伤害'
    const next = createGameRelease(data('2', 'b', { towers: [after] }), data('3', 'c', { towers: [later] }))
    expect(next.changes.map((change) => change.kind)).toEqual(['content'])
  })
})
