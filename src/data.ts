import rawData from './data/dove-data.json'
import type { DoveData } from './types'

export const doveData = rawData as DoveData
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
