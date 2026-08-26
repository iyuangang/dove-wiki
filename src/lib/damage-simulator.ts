export const damageTypeDefinitions = [
  {
    id: 'true',
    name: '真实伤害',
    shortName: '真实',
    code: 'TRUE',
    icon: '/damage-types/true.png',
    description: '无视护甲与魔抗，伤害值直接参与生命结算。',
    formula: '减伤率 = 0',
  },
  {
    id: 'physical',
    name: '物理伤害',
    shortName: '物理',
    code: 'PHYSICAL',
    icon: '/damage-types/physical.png',
    description: '由护甲等比例减伤；10% 护甲提供 10% 减伤。',
    formula: '减伤率 = 护甲',
  },
  {
    id: 'magical',
    name: '魔法伤害',
    shortName: '魔法',
    code: 'MAGICAL',
    icon: '/damage-types/magical.png',
    description: '由魔抗等比例减伤；10% 魔抗提供 10% 减伤。',
    formula: '减伤率 = 魔抗',
  },
  {
    id: 'explosion',
    name: '爆炸伤害',
    shortName: '爆炸',
    code: 'EXPLOSION',
    icon: '/damage-types/explosion.png',
    description: '读取护甲，但使用范围伤害曲线，高护甲的减伤低于普通物理。',
    formula: '减伤率 = 护甲 × (0.2 × 护甲 + 0.4)',
  },
  {
    id: 'magical-explosion',
    name: '法术爆炸伤害',
    shortName: '法术爆炸',
    code: 'MAGICAL EXPLOSION',
    icon: '/damage-types/magical-explosion.png',
    description: '读取魔抗，并使用与爆炸伤害相同的减伤曲线。',
    formula: '减伤率 = 魔抗 × (0.2 × 魔抗 + 0.4)',
  },
  {
    id: 'electrical',
    name: '雷电伤害',
    shortName: '雷电',
    code: 'ELECTRICAL',
    icon: '/damage-types/electrical.png',
    description: '只计算一半护甲，因此比普通物理伤害更容易穿透护甲。',
    formula: '减伤率 = 护甲 × 0.5',
  },
  {
    id: 'shot',
    name: '枪伤',
    shortName: '枪伤',
    code: 'SHOT',
    icon: '/damage-types/shot.png',
    description: '只计算七成护甲，减伤强度介于普通物理与电击之间。',
    formula: '减伤率 = 护甲 × 0.7',
  },
  {
    id: 'rude',
    name: '残暴伤害',
    shortName: '残暴',
    code: 'RUDE',
    icon: '/damage-types/rude.png',
    description: '读取护甲，实际采用与爆炸伤害相同的减伤曲线。',
    formula: '减伤率 = 护甲 × (0.2 × 护甲 + 0.4)',
  },
  {
    id: 'stab',
    name: '刺伤',
    shortName: '刺伤',
    code: 'STAB',
    icon: '/damage-types/stab.png',
    description: '基础伤害先翻倍，再使用专属护甲曲线进行减伤。',
    formula: '伤害 × 2；减伤率 = 护甲 × (2 - 护甲)',
  },
  {
    id: 'mixed',
    name: '混合伤害',
    shortName: '混合',
    code: 'MIXED',
    icon: '/damage-types/mixed.png',
    description: '魔抗高于护甲时只取护甲，否则取护甲与魔抗的平均值。',
    formula: '魔抗 > 护甲 ? 护甲 : (护甲 + 魔抗) ÷ 2',
  },
  {
    id: 'against-armor',
    name: '破甲伤害',
    shortName: '破甲',
    code: 'AGAINST ARMOR',
    icon: '/damage-types/against-armor.png',
    description: '先按物理伤害结算，再额外造成 2 × 原伤 × 护甲² 的真实伤害。',
    formula: '实际伤害 = 原伤 × (1 − 护甲) + 2 × 原伤 × 护甲²',
  },
  {
    id: 'against-magic-armor',
    name: '破魔伤害',
    shortName: '破魔',
    code: 'AGAINST MAGIC ARMOR',
    icon: '/damage-types/against-magic-armor.png',
    description: '先按法术伤害结算，再额外造成 2 × 原伤 × 魔抗² 的真实伤害。',
    formula: '实际伤害 = 原伤 × (1 − 魔抗) + 2 × 原伤 × 魔抗²',
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
  resistanceBonusDamage: number
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
  armorIgnore?: number
  criticalChance?: number
  criticalMultiplier?: number
  attackInterval?: number
  armorReductionPerHit?: number
  lowProtectionThreshold?: number
  lowProtectionMultiplier?: number
  unprotectedMultiplier?: number
  unsteadyChance?: number
  unsteadyMultiplier?: number
  secondaryMagicDamageFactor?: number
  flyingDamageMultiplier?: number
  magicDustChance?: number
  magicDustHpFactor?: number
  bleedChance?: number
  bleedDamageFactor?: number
  bleedTicks?: number
  bleedTickInterval?: number
  bleedDuration?: number
  bleedMaxStacks?: number
  seed?: number
  maxAttacks?: number
}

export interface AttackSequenceEntry extends DamageSimulationResult {
  index: number
  rolledDamage: number
  critical: boolean
  unsteady: boolean
  magicDust: boolean
  bleed: boolean
  technologyDamageMultiplier: number
  timestamp: number
  secondaryDamageApplied: number
  totalAttackDamageApplied: number
  totalAttackHpLost: number
  armorBefore: number
  effectiveArmor: number
  armorAfter: number
  technologyTriggers: string[]
}

export interface AttackSequenceResult {
  attacks: AttackSequenceEntry[]
  defeated: boolean
  truncated: boolean
  totalDamageApplied: number
  totalHpLost: number
  remainingHp: number
  criticalHits: number
  armorIgnored: number
  unsteadyHits: number
  magicDustHits: number
  bleedTriggers: number
  secondaryDamageApplied: number
  bleedDamageApplied: number
  elapsedTime: number
  finalBlow: 'attack' | 'bleed' | null
  finalArmor: number
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
    [131072, 'against-armor'],
    [262144, 'against-magic-armor'],
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
  if (label.includes('破魔')) return 'against-magic-armor'
  if (label.includes('破甲')) return 'against-armor'
  if (label.includes('混合')) return 'mixed'
  if (label.includes('刺伤') || label.includes('穿刺')) return 'stab'
  if (label.includes('残暴') || label.includes('粗暴')) return 'rude'
  if (label.includes('枪')) return 'shot'
  if (label.includes('雷电') || label.includes('电击')) return 'electrical'
  if (label.includes('法术爆炸') || label.includes('魔法范围')) return 'magical-explosion'
  if (label.includes('爆炸') || label.includes('物理范围') || label.includes('范围')) return 'explosion'
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
    case 'against-armor':
      protection = armor
      break
    case 'against-magic-armor':
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
  const resistanceBonusDamage =
    input.damageType === 'against-armor' || input.damageType === 'against-magic-armor'
      ? typeAdjustedDamage * protection * protection * 2
      : 0
  const damageApplied = typeAdjustedDamage * (1 - protection) + resistanceBonusDamage
  const hpLost = Math.min(hp, damageApplied)
  const remainingHp = Math.max(0, hp - damageApplied)

  return {
    baseDamage,
    typeAdjustedDamage,
    protection,
    resistanceBonusDamage,
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
  const armorIgnored = clamp(finiteOrZero(input.armorIgnore ?? 0), 0, 100)
  const startingArmor = clamp(finiteOrZero(input.armor), 0, 100)
  const magicArmor = clamp(finiteOrZero(input.magicArmor), 0, 100)
  const criticalChance = clamp(finiteOrZero(input.criticalChance ?? 0), 0, 1)
  const criticalMultiplier = Math.max(1, finiteOrZero(input.criticalMultiplier ?? 1))
  const attackInterval = Math.max(0, finiteOrZero(input.attackInterval ?? 0))
  const armorReductionPerHit = clamp(finiteOrZero(input.armorReductionPerHit ?? 0), 0, 100)
  const lowProtectionThreshold = clamp(finiteOrZero(input.lowProtectionThreshold ?? -1), -1, 1)
  const lowProtectionMultiplier = Math.max(1, finiteOrZero(input.lowProtectionMultiplier ?? 1))
  const unprotectedMultiplier = Math.max(1, finiteOrZero(input.unprotectedMultiplier ?? 1))
  const unsteadyChance = clamp(finiteOrZero(input.unsteadyChance ?? 0), 0, 1)
  const unsteadyMultiplier = Math.max(1, finiteOrZero(input.unsteadyMultiplier ?? 1))
  const secondaryMagicDamageFactor = Math.max(0, finiteOrZero(input.secondaryMagicDamageFactor ?? 0))
  const flyingDamageMultiplier = Math.max(1, finiteOrZero(input.flyingDamageMultiplier ?? 1))
  const magicDustChance = clamp(finiteOrZero(input.magicDustChance ?? 0), 0, 1)
  const magicDustHpFactor = Math.max(0, finiteOrZero(input.magicDustHpFactor ?? 0.004))
  const bleedChance = clamp(finiteOrZero(input.bleedChance ?? 0), 0, 1)
  const bleedDamageFactor = Math.max(0, finiteOrZero(input.bleedDamageFactor ?? 0.1))
  const bleedTicks = clamp(Math.trunc(finiteOrZero(input.bleedTicks ?? 23)), 1, 100)
  const bleedTickInterval = Math.max(0.001, finiteOrZero(input.bleedTickInterval ?? 4 / 30))
  const bleedDuration = Math.max(0.001, finiteOrZero(input.bleedDuration ?? 3))
  const bleedMaxStacks = clamp(Math.trunc(finiteOrZero(input.bleedMaxStacks ?? 5)), 1, 20)
  const maxAttacks = clamp(Math.trunc(finiteOrZero(input.maxAttacks ?? 10_000)), 1, 10_000)
  const random = createRandom(input.seed ?? 1)
  const attacks: AttackSequenceEntry[] = []
  const bleedEvents: Array<{ time: number; damage: number }> = []
  let bleedStackExpiries: number[] = []
  let remainingHp = startingHp
  let currentArmor = startingArmor
  let totalDamageApplied = 0
  let secondaryDamageApplied = 0
  let bleedDamageApplied = 0
  let criticalHits = 0
  let unsteadyHits = 0
  let magicDustHits = 0
  let bleedTriggers = 0
  let elapsedTime = 0
  let finalBlow: AttackSequenceResult['finalBlow'] = startingHp === 0 ? 'attack' : null

  function applyBleedEventsThrough(time: number) {
    bleedEvents.sort((left, right) => left.time - right.time)
    while (remainingHp > 0 && bleedEvents.length && bleedEvents[0]!.time <= time + 1e-9) {
      const event = bleedEvents.shift()!
      remainingHp = Math.max(0, remainingHp - event.damage)
      totalDamageApplied += event.damage
      bleedDamageApplied += event.damage
      elapsedTime = event.time
      if (remainingHp === 0) finalBlow = 'bleed'
    }
  }

  const initialEffectiveArmor = Math.max(0, currentArmor - armorIgnored)
  const initialProtection = calculateDamageProtection(
    input.damageType,
    initialEffectiveArmor,
    magicArmor,
  )
  const maximumMultiplier =
    (criticalChance > 0 ? criticalMultiplier : 1) *
    (lowProtectionThreshold >= 0 && initialProtection <= lowProtectionThreshold
      ? lowProtectionMultiplier
      : 1) *
    (initialProtection <= 0 ? unprotectedMultiplier : 1) *
    flyingDamageMultiplier
  const maximumHit = simulateDamage({
    damageType: input.damageType,
    damage:
      unsteadyChance > 0 && initialProtection < 1
        ? upper * maximumMultiplier * unsteadyMultiplier / (1 - initialProtection)
        : upper * maximumMultiplier,
    hp: startingHp,
    armor: initialEffectiveArmor,
    magicArmor,
  })
  const canGainDamageLater =
    armorReductionPerHit > 0 ||
    secondaryMagicDamageFactor > 0 ||
    magicDustChance > 0 ||
    bleedChance > 0

  if (startingHp > 0 && maximumHit.damageApplied <= 0 && !canGainDamageLater) {
    return {
      attacks,
      defeated: false,
      truncated: false,
      totalDamageApplied: 0,
      totalHpLost: 0,
      remainingHp,
      criticalHits,
      armorIgnored,
      unsteadyHits,
      magicDustHits,
      bleedTriggers,
      secondaryDamageApplied,
      bleedDamageApplied,
      elapsedTime,
      finalBlow,
      finalArmor: currentArmor,
    }
  }

  while (remainingHp > 0 && attacks.length < maxAttacks) {
    const timestamp = attacks.length * attackInterval
    applyBleedEventsThrough(timestamp)
    if (remainingHp <= 0) break

    const rolledDamage = rollDamage(lower, upper, random)
    const critical = criticalChance > 0 && random() < criticalChance
    const armorBefore = currentArmor
    const effectiveArmor = Math.max(0, armorBefore - armorIgnored)
    const protection = calculateDamageProtection(input.damageType, effectiveArmor, magicArmor)
    const technologyTriggers: string[] = []
    let directDamage = rolledDamage

    if (critical) {
      directDamage *= criticalMultiplier
      criticalHits += 1
      technologyTriggers.push(`精准 ×${criticalMultiplier}`)
    }
    if (lowProtectionThreshold >= 0 && protection <= lowProtectionThreshold) {
      directDamage *= lowProtectionMultiplier
      technologyTriggers.push(`低护甲 ×${lowProtectionMultiplier}`)
    }
    if (flyingDamageMultiplier > 1) {
      directDamage *= flyingDamageMultiplier
      technologyTriggers.push(`对空 ×${flyingDamageMultiplier}`)
    }
    if (protection <= 0 && unprotectedMultiplier > 1) {
      directDamage *= unprotectedMultiplier
      technologyTriggers.push(`无抗 ×${unprotectedMultiplier}`)
    }

    const magicDust = magicDustChance > 0 && random() < magicDustChance
    if (magicDust) {
      directDamage += startingHp * magicDustHpFactor * Math.sqrt(directDamage + 1)
      magicDustHits += 1
      technologyTriggers.push('魔法粉尘')
    }

    const unsteady = unsteadyChance > 0 && protection < 1 && random() < unsteadyChance
    if (unsteady) {
      directDamage *= unsteadyMultiplier / (1 - protection)
      unsteadyHits += 1
      technologyTriggers.push(`不稳定 ×${unsteadyMultiplier} · 无视抗性`)
    }

    const technologyDamageMultiplier = rolledDamage > 0 ? directDamage / rolledDamage : 1
    const damage = simulateDamage({
      damageType: input.damageType,
      damage: directDamage,
      hp: remainingHp,
      armor: effectiveArmor,
      magicArmor,
    })
    remainingHp = damage.remainingHp
    totalDamageApplied += damage.damageApplied

    let attackSecondaryDamageApplied = 0
    let totalAttackHpLost = damage.hpLost
    if (remainingHp > 0 && secondaryMagicDamageFactor > 0) {
      const magicDamage = Math.ceil(Math.max(directDamage * secondaryMagicDamageFactor, 1))
      const secondary = simulateDamage({
        damageType: 'magical',
        damage: magicDamage,
        hp: remainingHp,
        armor: effectiveArmor,
        magicArmor,
      })
      remainingHp = secondary.remainingHp
      totalDamageApplied += secondary.damageApplied
      secondaryDamageApplied += secondary.damageApplied
      attackSecondaryDamageApplied = secondary.damageApplied
      totalAttackHpLost += secondary.hpLost
      technologyTriggers.push(`附魔 +${Math.round(secondary.damageApplied * 1000) / 1000}`)
    }

    if (armorReductionPerHit > 0) {
      currentArmor = Math.max(0, currentArmor - armorReductionPerHit)
      technologyTriggers.push(`破甲 −${armorReductionPerHit}`)
    }

    let bleed = false
    if (remainingHp > 0 && bleedChance > 0 && random() < bleedChance) {
      bleedStackExpiries = bleedStackExpiries.filter((expiry) => expiry > timestamp + 1e-9)
      if (bleedStackExpiries.length < bleedMaxStacks) {
        bleed = true
        bleedTriggers += 1
        bleedStackExpiries.push(timestamp + bleedDuration)
        const tickDamage = Math.max(damage.damageApplied * bleedDamageFactor, 1)
        const immediateHpLost = Math.min(remainingHp, tickDamage)
        remainingHp = Math.max(0, remainingHp - tickDamage)
        totalDamageApplied += tickDamage
        bleedDamageApplied += tickDamage
        totalAttackHpLost += immediateHpLost
        technologyTriggers.push('放血 23 跳')
        for (let tick = 1; tick < bleedTicks; tick += 1) {
          bleedEvents.push({ time: timestamp + tick * bleedTickInterval, damage: tickDamage })
        }
        if (remainingHp === 0) finalBlow = 'bleed'
      }
    }

    const totalAttackDamageApplied =
      damage.damageApplied + attackSecondaryDamageApplied + (bleed ? Math.max(damage.damageApplied * bleedDamageFactor, 1) : 0)

    attacks.push({
      ...damage,
      index: attacks.length + 1,
      rolledDamage,
      critical,
      unsteady,
      magicDust,
      bleed,
      technologyDamageMultiplier,
      timestamp,
      secondaryDamageApplied: attackSecondaryDamageApplied,
      totalAttackDamageApplied,
      totalAttackHpLost,
      armorBefore,
      effectiveArmor,
      armorAfter: currentArmor,
      remainingHp,
      remainingHpPercent: startingHp > 0 ? (remainingHp / startingHp) * 100 : 0,
      technologyTriggers,
    })
    elapsedTime = timestamp
    if (remainingHp === 0 && !finalBlow) finalBlow = 'attack'
  }

  if (remainingHp > 0 && attacks.length === maxAttacks && bleedEvents.length) {
    applyBleedEventsThrough(Number.POSITIVE_INFINITY)
  }

  const defeated = startingHp === 0 || remainingHp === 0
  return {
    attacks,
    defeated,
    truncated: !defeated && attacks.length === maxAttacks,
    totalDamageApplied,
    totalHpLost: startingHp - remainingHp,
    remainingHp,
    criticalHits,
    armorIgnored,
    unsteadyHits,
    magicDustHits,
    bleedTriggers,
    secondaryDamageApplied,
    bleedDamageApplied,
    elapsedTime,
    finalBlow,
    finalArmor: currentArmor,
  }
}
