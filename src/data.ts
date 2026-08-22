import rawData from './data/dove-data.json'
import rawGameChangelog from './data/game-changelog.json'
import { publicAssetUrl } from './lib/public-assets'
import type { DoveData, GameChangelog } from './types'

const sourceData = rawData as DoveData

export const doveData: DoveData = {
  ...sourceData,
  technologyTrees: sourceData.technologyTrees.map((tree) => ({
    ...tree,
    technologies: tree.technologies.map((technology) => ({
      ...technology,
      icon: publicAssetUrl(technology.icon),
    })),
  })),
  heroes: sourceData.heroes.map((hero) => ({
    ...hero,
    image: publicAssetUrl(hero.image),
    thumbnail: publicAssetUrl(hero.thumbnail),
  })),
  enemies: sourceData.enemies.map((enemy) => ({
    ...enemy,
    image: publicAssetUrl(enemy.image),
    thumbnail: publicAssetUrl(enemy.thumbnail),
  })),
  supportEffects: sourceData.supportEffects.map((effect) => ({
    ...effect,
    icon: effect.icon ? publicAssetUrl(effect.icon) : null,
  })),
  towers: sourceData.towers.map((tower) => ({
    ...tower,
    image: publicAssetUrl(tower.image),
    encyclopediaImage: publicAssetUrl(tower.encyclopediaImage),
    powers: tower.powers.map((power) => ({
      ...power,
      icon: power.icon ? publicAssetUrl(power.icon) : null,
    })),
  })),
}

export const siteVersion = import.meta.env.VITE_APP_VERSION?.trim() || 'dev'
export const gameChangelog: GameChangelog = {
  ...(rawGameChangelog as GameChangelog),
  releases: (rawGameChangelog as GameChangelog).releases.map((release) => ({
    ...release,
    changes: release.changes.map((change) => ({
      ...change,
      image: change.image ? publicAssetUrl(change.image) : null,
    })),
  })),
}
export const towers = doveData.towers
export const towerById = new Map(towers.map((tower) => [tower.id, tower]))
export const heroes = doveData.heroes
export const heroById = new Map(heroes.map((hero) => [hero.id, hero]))
export const enemies = doveData.enemies

export const familyLabels = {
  archer: '弓箭塔',
  mage: '法师塔',
  engineer: '工程塔',
  barrack: '兵营塔',
} as const

export const unlockLabels = {
  all: '全部解锁状态',
  default: '默认可用',
  level: '关卡解锁',
  missing: '数据异常',
} as const
