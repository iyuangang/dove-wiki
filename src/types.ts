export type TowerFamily = 'archer' | 'mage' | 'engineer' | 'barrack'
export type UnlockStatus = 'default' | 'level' | 'missing'
export type Confidence = '精确' | '脚本近似' | '不可统一折算'

export interface UnlockInfo {
  status: UnlockStatus
  level?: number
  label: string
  source: string
}

export interface TowerAttack {
  damageMin: number | null
  damageMax: number | null
  cooldown: number | null
  dps: number | null
  range: number | null
  rallyRange: number | null
  damageType: string
  damageTypeValue: number | null
  kind: string
  confidence: Confidence
  scope: string
}

export interface TowerPower {
  id: string
  name: string
  icon: string | null
  iconSprite: string | null
  maxLevel: number
  priceBase: number | null
  priceIncrement: number | null
  descriptions: Array<{ key: string; text: string }>
}

export interface Tower {
  id: string
  name: string
  description: string
  families: TowerFamily[]
  roles: string[]
  image: string
  encyclopediaImage: string
  encyclopediaOrder: number
  encyclopediaListed: boolean
  encyclopediaSprite: string | null
  encyclopediaThumbSprite: string | null
  sourceGame: number | null
  portraitSprite: string | null
  price: number | null
  level: number | null
  towerType: string | null
  canBeBuffed: boolean
  unlock: UnlockInfo
  attack: TowerAttack
  soldier: {
    count: number | null
    hp: number | null
    armor: number | null
    magicArmor: number | null
    respawn: number | null
  } | null
  powers: TowerPower[]
  sources: {
    template: string | null
    nameKey: string | null
    descriptionKey: string | null
    localization: string
    portrait: string
    encyclopedia: string | null
    unlock: string
  }
}

export interface SupportLevel {
  level: number
  radius: number
  damageBonus?: number
  rangeBonus?: number
  speedBonus?: number
  cooldownMultiplier?: number
  damagePerTrigger?: number
  triggerCap?: number
  duration?: number
  cycle?: number
  priceMultiplier?: number
  flatDps?: number
}

export interface SupportEffect {
  id: string
  sourceType: 'tower' | 'hero'
  sourceTowerId?: string
  sourceHeroId?: string
  skillId: string
  name: string
  mode: 'aura' | 'temporary' | 'triggered' | 'passive'
  levels: SupportLevel[]
  note: string
  icon: string | null
  requiresBuffable?: boolean
}

export interface HeroSkill {
  id: string
  maxLevel: number
  unlockLevels: Array<{ heroLevel: number; skillLevel: number }>
}

export interface HeroAbility {
  name: string
  description: string
}

export interface Hero {
  id: string
  name: string
  description: string
  specialties: string[]
  image: string
  thumbnail: string
  sourceGame: number
  availableLevel: number
  startingLevel: number
  profileStats: number[]
  maxStats: {
    hp: number | null
    armor: number | null
    magicArmor: number | null
    meleeDamageMin: number | null
    meleeDamageMax: number | null
    rangedDamageMin: number | null
    rangedDamageMax: number | null
  }
  skills: HeroSkill[]
  abilities: HeroAbility[]
  sources: {
    template: string | null
    roster: string
    localization: string
    portrait: string
  }
}

export interface Enemy {
  entryId: string
  id: string
  order: number
  name: string
  description: string
  special: string
  traits: string[]
  image: string
  thumbnail: string
  imageSprite: string | null
  thumbnailSprite: string | null
  sourceGame: number
  alwaysShown: boolean
  flying: boolean
  boss: boolean
  stats: {
    hp: number | null
    damageMin: number | null
    damageMax: number | null
    armor: number | null
    magicArmor: number | null
    speed: number | null
    lives: number | null
    gold: number | null
  }
  sources: {
    roster: string
    template: string | null
    localization: string
    encyclopedia: string
  }
}

export type TechnologyMetric =
  | 'damage'
  | 'expectedDps'
  | 'range'
  | 'cooldown'
  | 'price'
  | 'rallyRange'
  | 'soldierHp'
  | 'soldierArmor'
  | 'soldierMagicArmor'
  | 'respawn'
  | 'soldierCount'

export interface TechnologyModifier {
  metric: TechnologyMetric
  operation: 'multiply' | 'add' | 'average' | 'table'
  value?: number
  values?: number[]
  rounding?: 'ceil' | 'floor'
  includeTowerIds?: string[]
  excludeTowerIds?: string[]
}

export type TechnologyFamily = TowerFamily | 'rain' | 'reinforcement'

export interface Technology {
  id: string
  family: TechnologyFamily
  level: number
  price: number
  icon: string
  iconSprite: string | null
  name: string
  description: string
  modifiers: TechnologyModifier[]
}

export interface TechnologyTree {
  id: number
  name: string
  source: string
  maxLevel: number
  technologies: Technology[]
}

export type GameChangeCategory = 'hero' | 'tower' | 'enemy' | 'technology'
export type GameChangeKind = 'added' | 'removed' | 'balance' | 'content'

export interface GameChangeDetail {
  field: string
  before: string
  after: string
  delta: string | null
  direction: 'increase' | 'decrease' | 'changed'
}

export interface GameChange {
  id: string
  category: GameChangeCategory
  kind: GameChangeKind
  entityId: string
  entityName: string
  title: string
  description: string
  image: string | null
  details: GameChangeDetail[]
}

export interface GameRelease {
  id: string
  version: string
  previousVersion: string
  contentVersion: string
  commitHash: string
  previousCommitHash: string
  detectedAt: string
  summary: {
    changeCount: number
    categoryCounts: Record<GameChangeCategory, number>
    kindCounts: Record<GameChangeKind, number>
  }
  changes: GameChange[]
}

export interface GameChangelog {
  schemaVersion: number
  generatedAt: string | null
  releases: GameRelease[]
}

export interface DoveData {
  metadata: {
    title: string
    gameVersion: string
    contentVersion: string
    gameId: string
    commitHash: string
    generatedAt: string
    sourceRoot: string
    assumptions: string[]
  }
  summary: {
    towerCount: number
    portraitCount: number
    encyclopediaImageCount: number
    portraitFallbackCount: number
    skillIconCount: number
    technologyTreeCount: number
    technologyCount: number
    heroCount: number
    enemyCount: number
    uniqueEnemyCount: number
    enemyImageCount: number
    supportTowerCount: number
    supportHeroCount: number
    supportEffectCount: number
    levelUnlockCount: number
    defaultUnlockCount: number
    unlockAnomalyCount: number
    exactDamageCount: number
  }
  validation: {
    warnings: string[]
    unlockAnomalies: string[]
    noUnifiedDamage: string[]
    missingTemplateSources: string[]
  }
  supportEffects: SupportEffect[]
  technologyTrees: TechnologyTree[]
  heroes: Hero[]
  enemies: Enemy[]
  towers: Tower[]
}
