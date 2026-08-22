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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteOrZero(value: number) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
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
