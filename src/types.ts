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
  damagePerTrigger?: number
  triggerCap?: number
  duration?: number
  cycle?: number
}

export interface SupportEffect {
  id: string
  sourceTowerId: string
  skillId: string
  name: string
  mode: 'aura' | 'temporary' | 'triggered'
  levels: SupportLevel[]
  note: string
}

export interface DoveData {
  metadata: {
    title: string
    gameVersion: string
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
    supportTowerCount: number
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
  towers: Tower[]
}
