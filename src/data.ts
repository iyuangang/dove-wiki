import rawData from './data/dove-data.json'
import { publicAssetUrl } from './lib/public-assets'
import type { DoveData } from './types'

const sourceData = rawData as DoveData

export const doveData: DoveData = {
  ...sourceData,
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
export const towers = doveData.towers
export const towerById = new Map(towers.map((tower) => [tower.id, tower]))

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
