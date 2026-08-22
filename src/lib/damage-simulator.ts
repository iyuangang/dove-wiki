export const damageTypeDefinitions = [
  {
    id: 'true',
    name: '真实伤害',
    shortName: '真实',
    code: 'TRUE',
    description: '无视护甲与魔抗，伤害值直接参与生命结算。',
    formula: '减伤率 = 0',
  },
  {
    id: 'physical',
    name: '物理伤害',
    shortName: '物理',
    code: 'PHYSICAL',
    description: '由护甲等比例减伤；10% 护甲提供 10% 减伤。',
    formula: '减伤率 = 护甲',
  },
  {
    id: 'magical',
    name: '魔法伤害',
    shortName: '魔法',
    code: 'MAGICAL',
    description: '由魔抗等比例减伤；10% 魔抗提供 10% 减伤。',
    formula: '减伤率 = 魔抗',
  },
  {
    id: 'explosion',
    name: '物理范围伤害',
    shortName: '范围',
    code: 'EXPLOSION',
    description: '读取护甲，但使用范围伤害曲线，高护甲的减伤低于普通物理。',
    formula: '减伤率 = 护甲 × (0.2 × 护甲 + 0.4)',
  },
  {
    id: 'magical-explosion',
    name: '魔法范围伤害',
    shortName: '魔法范围',
    code: 'MAGICAL EXPLOSION',
    description: '读取魔抗，并使用与物理范围伤害相同的曲线。',
    formula: '减伤率 = 魔抗 × (0.2 × 魔抗 + 0.4)',
  },
  {
    id: 'electrical',
    name: '电击伤害',
    shortName: '电击',
    code: 'ELECTRICAL',
    description: '只计算一半护甲，因此比普通物理伤害更容易穿透护甲。',
    formula: '减伤率 = 护甲 × 0.5',
  },
  {
    id: 'shot',
    name: '枪伤',
    shortName: '枪伤',
    code: 'SHOT',
    description: '只计算七成护甲，减伤强度介于普通物理与电击之间。',
    formula: '减伤率 = 护甲 × 0.7',
  },
  {
    id: 'rude',
    name: '粗暴伤害',
    shortName: '粗暴',
    code: 'RUDE',
    description: '读取护甲，实际采用与物理范围伤害相同的减伤曲线。',
    formula: '减伤率 = 护甲 × (0.2 × 护甲 + 0.4)',
  },
  {
    id: 'stab',
    name: '穿刺伤害',
    shortName: '穿刺',
    code: 'STAB',
    description: '基础伤害先翻倍，再使用专属护甲曲线进行减伤。',
    formula: '伤害 × 2；减伤率 = 护甲 × (2 - 护甲)',
  },
  {
    id: 'mixed',
    name: '混合伤害',
    shortName: '混合',
    code: 'MIXED',
    description: '魔抗高于护甲时只取护甲，否则取护甲与魔抗的平均值。',
    formula: '魔抗 > 护甲 ? 护甲 : (护甲 + 魔抗) ÷ 2',
  },
] as const

export type DamageTypeId = (typeof damageTypeDefinitions)[number]['id']

export interface DamageSimulationInput {
  damageType: DamageTypeId
  damage: number
  hp: number
  armor: number
  magicArmor: number
}

export interface DamageSimulationResult {
  baseDamage: number
  typeAdjustedDamage: number
  protection: number
  damageApplied: number
  hpLost: number
  remainingHp: number
  remainingHpPercent: number
  overkill: number
}

export interface AttackSequenceInput {
  damageType: DamageTypeId
  damageMin: number
  damageMax: number
  hp: number
  armor: number
  magicArmor: number
  seed?: number
  maxAttacks?: number
}

export interface AttackSequenceEntry extends DamageSimulationResult {
  index: number
  rolledDamage: number
}

export interface AttackSequenceResult {
  attacks: AttackSequenceEntry[]
  defeated: boolean
  truncated: boolean
  totalDamageApplied: number
  totalHpLost: number
  remainingHp: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteOrZero(value: number) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

export function damageTypeFromGame(
  damageTypeValue: number | null,
  damageTypeLabel = '',
): DamageTypeId {
  const value = Math.max(0, Math.trunc(finiteOrZero(damageTypeValue ?? 0)))
  const bitTypes: Array<[number, DamageTypeId]> = [
    [1, 'true'],
    [2, 'physical'],
    [4, 'magical'],
    [32, 'magical-explosion'],
    [8, 'explosion'],
    [16, 'electrical'],
    [64, 'shot'],
    [128, 'rude'],
    [256, 'stab'],
    [512, 'mixed'],
  ]
  const matched = bitTypes.find(([bit]) => (value & bit) !== 0)
  if (matched) return matched[1]

  const label = damageTypeLabel.trim().toLowerCase()
  if (label.includes('真实')) return 'true'
  if (label.includes('混合')) return 'mixed'
  if (label.includes('穿刺')) return 'stab'
  if (label.includes('粗暴')) return 'rude'
  if (label.includes('枪')) return 'shot'
  if (label.includes('电')) return 'electrical'
  if (label.includes('魔法范围')) return 'magical-explosion'
  if (label.includes('物理范围') || label.includes('范围')) return 'explosion'
  if (label.includes('魔法')) return 'magical'
  return 'physical'
}

export function calculateDamageProtection(
  damageType: DamageTypeId,
  armorPercent: number,
  magicArmorPercent: number,
) {
  const armor = clamp(finiteOrZero(armorPercent) / 100, 0, 1)
  const magicArmor = clamp(finiteOrZero(magicArmorPercent) / 100, 0, 1)
  let protection = 0

  switch (damageType) {
    case 'physical':
      protection = armor
      break
    case 'magical':
      protection = magicArmor
      break
    case 'explosion':
    case 'rude':
      protection = armor * (0.2 * armor + 0.4)
      break
    case 'magical-explosion':
      protection = magicArmor * (0.2 * magicArmor + 0.4)
      break
    case 'electrical':
      protection = armor * 0.5
      break
    case 'shot':
      protection = armor * 0.7
      break
    case 'stab':
      protection = armor * (2 - armor)
      break
    case 'mixed':
      protection = magicArmor > armor ? armor : (magicArmor + armor) * 0.5
      break
    case 'true':
      protection = 0
      break
  }

  return clamp(protection, 0, 1)
}

export function simulateDamage(input: DamageSimulationInput): DamageSimulationResult {
  const baseDamage = Math.max(0, finiteOrZero(input.damage))
  const hp = Math.max(0, finiteOrZero(input.hp))
  const typeAdjustedDamage = input.damageType === 'stab' ? baseDamage * 2 : baseDamage
  const protection = calculateDamageProtection(
    input.damageType,
    input.armor,
    input.magicArmor,
  )
  const damageApplied = typeAdjustedDamage * (1 - protection)
  const hpLost = Math.min(hp, damageApplied)
  const remainingHp = Math.max(0, hp - damageApplied)

  return {
    baseDamage,
    typeAdjustedDamage,
    protection,
    damageApplied,
    hpLost,
    remainingHp,
    remainingHpPercent: hp > 0 ? clamp((remainingHp / hp) * 100, 0, 100) : 0,
    overkill: Math.max(0, damageApplied - hp),
  }
}

function createRandom(seed: number) {
  let state = Math.trunc(finiteOrZero(seed)) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function rollDamage(minimum: number, maximum: number, random: () => number) {
  if (minimum === maximum) return minimum
  if (Number.isInteger(minimum) && Number.isInteger(maximum)) {
    return Math.floor(random() * (maximum - minimum + 1)) + minimum
  }
  return Math.round((minimum + random() * (maximum - minimum)) * 1000) / 1000
}

export function simulateAttackSequence(input: AttackSequenceInput): AttackSequenceResult {
  const lower = Math.max(0, Math.min(finiteOrZero(input.damageMin), finiteOrZero(input.damageMax)))
  const upper = Math.max(lower, finiteOrZero(input.damageMin), finiteOrZero(input.damageMax))
  const startingHp = Math.max(0, finiteOrZero(input.hp))
  const maxAttacks = clamp(Math.trunc(finiteOrZero(input.maxAttacks ?? 10_000)), 1, 10_000)
  const random = createRandom(input.seed ?? 1)
  const attacks: AttackSequenceEntry[] = []
  let remainingHp = startingHp
  let totalDamageApplied = 0

  const maximumHit = simulateDamage({
    damageType: input.damageType,
    damage: upper,
    hp: startingHp,
    armor: input.armor,
    magicArmor: input.magicArmor,
  })
  if (startingHp > 0 && maximumHit.damageApplied <= 0) {
    return {
      attacks,
      defeated: false,
      truncated: false,
      totalDamageApplied: 0,
      totalHpLost: 0,
      remainingHp,
    }
  }

  while (remainingHp > 0 && attacks.length < maxAttacks) {
    const rolledDamage = rollDamage(lower, upper, random)
    const damage = simulateDamage({
      damageType: input.damageType,
      damage: rolledDamage,
      hp: remainingHp,
      armor: input.armor,
      magicArmor: input.magicArmor,
    })

    attacks.push({
      ...damage,
      index: attacks.length + 1,
      rolledDamage,
    })
    totalDamageApplied += damage.damageApplied
    remainingHp = damage.remainingHp
  }

  const defeated = startingHp === 0 || remainingHp === 0
  return {
    attacks,
    defeated,
    truncated: !defeated && attacks.length === maxAttacks,
    totalDamageApplied,
    totalHpLost: startingHp - remainingHp,
    remainingHp,
  }
}
