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
  sources: {
    template: string | null
    roster: string
    localization: string
    portrait: string
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

export interface Technology {
  id: string
  family: TowerFamily
  level: number
  price: number
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
  towers: Tower[]
}
