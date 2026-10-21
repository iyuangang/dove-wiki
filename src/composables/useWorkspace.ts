import { inject, reactive, type InjectionKey } from 'vue'
import type { DamageTypeId } from '../lib/damage-simulator'
import type { TabId } from '../lib/navigation'
import type { Enemy, GameChangeCategory, GameChangeKind, SupportEffect, TechnologyTree, TowerFamily, UnlockStatus } from '../types'

export interface LoadedEnemy {
  id: string
  name: string
  difficulty: number
  hp: number
  armor: number
  magicArmor: number
  flying: boolean
}

function calculatorDefaults(effects: SupportEffect[], trees: TechnologyTree[]) {
  return {
    targetId: 'tower_ranger',
    supportSourceFilter: 'all' as 'all' | 'tower' | 'hero' | 'selected',
    supportSearch: '',
    technologyTreeId: trees[0]?.id || 1,
    technologyLevels: { archer: 0, barrack: 0, mage: 0, engineer: 0 } as Record<TowerFamily, number>,
    mageTowerCount: 1, nearbyEnemyCount: 1,
    attackSource: 'tower' as 'tower' | 'custom',
    demoDamageType: 'true' as DamageTypeId,
    customDamage: { min: 100, max: 100 }, customAttackInterval: 1,
    dummy: { hp: 1000, armor: 10, magicArmor: 10, flying: false },
    enemyPresetId: '', enemyPresetDifficulty: 2,
    loadedEnemy: null as LoadedEnemy | null,
    simulationSeed: 2058, attackPage: 1, curveDefense: 10,
    curveFocusGroupId: null as string | null,
    notice: '',
    effects: Object.fromEntries(effects.map(effect => [effect.id, {
      enabled: false, level: effect.levels.at(-1)?.level || 1,
      triggers: 0, sourceRange: effect.levels[0]?.radius || 0, distancePercent: 100,
    }])),
  }
}

export function createWorkspace(effects: SupportEffect[], trees: TechnologyTree[]) {
  return reactive({
    calculator: calculatorDefaults(effects, trees),
    catalog: { search: '', family: 'all' as 'all' | TowerFamily, role: 'all', unlock: 'all' as 'all' | UnlockStatus, sort: 'encyclopedia' as 'encyclopedia' | 'name' | 'damage' | 'range' | 'unlock' },
    enemies: { query: '', sourceGame: 0, movement: 'all', rank: 'all', defense: 'all', difficulty: 2 },
    heroes: { query: '', sourceGame: 0, supportOnly: false, movementFilter: '' },
    compare: { leftId: 'tower_ranger', rightId: 'tower_high_elven' },
    technology: { activeTreeId: String(trees[0]?.id || 1) },
    updates: { query: '', categoryFilter: 'all' as 'all' | GameChangeCategory, kindFilter: 'all' as 'all' | GameChangeKind },
    scroll: {} as Partial<Record<TabId, number>>,
  })
}

export type Workspace = ReturnType<typeof createWorkspace>
export const workspaceKey: InjectionKey<Workspace> = Symbol('wiki-workspace')

export function useWorkspace() {
  const workspace = inject(workspaceKey)
  if (!workspace) throw new Error('页面未初始化工作区')
  return workspace
}

export function resetCalculator(workspace: Workspace, effects: SupportEffect[], trees: TechnologyTree[]) {
  const config = workspace.calculator
  const defaults = calculatorDefaults(effects, trees)
  for (const key of ['technologyLevels', 'customDamage', 'dummy', 'effects'] as const) {
    Object.assign(config[key], defaults[key])
  }
  Object.assign(config, { ...defaults, technologyLevels: config.technologyLevels, customDamage: config.customDamage, dummy: config.dummy, effects: config.effects })
}

export function loadEnemyPanel(config: Workspace['calculator'], enemy: Enemy, difficulty: number) {
  const stats = enemy.statsByDifficulty.find(variant => variant.difficulty === difficulty)?.stats
  if (!stats || stats.hp === null) return false
  config.enemyPresetId = enemy.id
  config.enemyPresetDifficulty = difficulty
  const panel = { hp: stats.hp, armor: (stats.armor || 0) * 100, magicArmor: (stats.magicArmor || 0) * 100, flying: enemy.flying }
  Object.assign(config.dummy, panel)
  config.loadedEnemy = { id: enemy.id, name: enemy.name, difficulty, ...panel }
  config.attackPage = 1
  return true
}
