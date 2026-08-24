<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { familyLabels } from '../data'
import {
  calculateBuffs,
  formatNumber,
  formatPercent,
  type SupportSelection,
  type TechnologySelection,
} from '../lib/calculator'
import {
  damageTypeFromGame,
  damageTypeDefinitions,
  simulateAttackSequence,
  simulateDamage,
  type DamageTypeId,
} from '../lib/damage-simulator'
import type {
  Hero,
  SupportEffect,
  SupportLevel,
  TechnologyTree,
  Tower,
  TowerFamily,
} from '../types'

const props = defineProps<{
  towers: Tower[]
  heroes: Hero[]
  effects: SupportEffect[]
  technologyTrees: TechnologyTree[]
}>()
defineEmits<{ open: [tower: Tower] }>()

interface EffectState {
  enabled: boolean
  level: number
  triggers: number
}

interface SimulationTechnologyEffect {
  id: string
  name: string
  description: string
  active: boolean
}

interface DamageCurveGroup {
  id: string
  name: string
  damageTypes: DamageTypeId[]
  className: string
}

const technologyFamilies: TowerFamily[] = ['archer', 'barrack', 'mage', 'engineer']
const supportedSimulationTechnologyIds = new Set([
  'archer_piercing',
  'archer_precision',
  'archer_el_bloodletting_shoot',
  'archer_tear',
  'archer_obsidian',
  'archer_magic',
  'archer_fly_killer',
  'mage_arcane_shatter',
  'mage_strike',
  'mage_unsteady',
  'mage_purge_field',
  'engineer_magic_dust',
])
const magicDustCompensationTowerIds = new Set([
  'tower_tesla',
  'tower_frankenstein',
  'tower_rotten_forest',
  'tower_ignis_altar',
  'tower_sandworm',
])
const damageCurveGroups: DamageCurveGroup[] = [
  { id: 'true', name: '真实', damageTypes: ['true'], className: 'series-true' },
  {
    id: 'direct',
    name: '物理 / 魔法',
    damageTypes: ['physical', 'magical'],
    className: 'series-direct',
  },
  {
    id: 'area',
    name: '范围 / 粗暴',
    damageTypes: ['explosion', 'magical-explosion', 'rude'],
    className: 'series-area',
  },
  {
    id: 'electrical',
    name: '电击',
    damageTypes: ['electrical'],
    className: 'series-electrical',
  },
  { id: 'shot', name: '枪伤', damageTypes: ['shot'], className: 'series-shot' },
  { id: 'stab', name: '穿刺', damageTypes: ['stab'], className: 'series-stab' },
  { id: 'mixed', name: '混合', damageTypes: ['mixed'], className: 'series-mixed' },
]
const targetId = ref('tower_ranger')
const technologyTreeId = ref(props.technologyTrees[0]?.id || 1)
const technologyLevels = reactive<Record<TowerFamily, number>>({
  archer: 0,
  barrack: 0,
  mage: 0,
  engineer: 0,
})
const mageTowerCount = ref(1)
const nearbyEnemyCount = ref(1)
const attackSource = ref<'tower' | 'custom'>('tower')
const demoDamageType = ref<DamageTypeId>('true')
const customDamage = reactive({
  min: 100,
  max: 100,
})
const dummy = reactive({
  hp: 1000,
  armor: 10,
  magicArmor: 10,
  flying: false,
})
const simulationSeed = ref(2058)
const attackPage = ref(1)
const curveDefense = ref(10)
const curveFocusGroupId = ref<string | null>(null)
const curveChartHost = ref<HTMLElement | null>(null)
const curveChartWidth = ref(760)
const attackPageSize = 25
let curveResizeObserver: ResizeObserver | undefined
const state = reactive<Record<string, EffectState>>(
  Object.fromEntries(
    props.effects.map((effect) => [
      effect.id,
      {
        enabled: false,
        level: effect.levels.at(-1)?.level || 1,
        triggers: 0,
      },
    ]),
  ),
)

const selectedTower = computed(
  () => props.towers.find((tower) => tower.id === targetId.value) || props.towers[0],
)
const selectedTree = computed(
  () =>
    props.technologyTrees.find((tree) => tree.id === technologyTreeId.value) ||
    props.technologyTrees[0],
)
const technologyLevelOptions = computed(() =>
  Array.from({ length: (selectedTree.value?.maxLevel || 0) + 1 }, (_, level) => level),
)
const selectedEffects = computed<SupportSelection[]>(() =>
  props.effects
    .filter((effect) => state[effect.id]?.enabled)
    .map((effect) => ({
      effectId: effect.id,
      level: state[effect.id]?.level || 1,
      triggers: state[effect.id]?.triggers || 0,
    })),
)
const technologySelection = computed<TechnologySelection>(() => ({
  treeId: technologyTreeId.value,
  levels: { ...technologyLevels },
  mageTowerCount: mageTowerCount.value,
  nearbyEnemyCount: nearbyEnemyCount.value,
}))
const result = computed(() =>
  calculateBuffs(
    selectedTower.value,
    props.effects,
    selectedEffects.value,
    props.technologyTrees,
    technologySelection.value,
  ),
)
const sourceById = computed(() => new Map(props.towers.map((tower) => [tower.id, tower])))
const heroById = computed(() => new Map(props.heroes.map((hero) => [hero.id, hero])))
const needsMageTowerCount = computed(() =>
  result.value.appliedTechnologies.some(
    (technology) => technology.technologyId === 'mage_brilliance',
  ),
)
const needsNearbyEnemyCount = computed(() =>
  result.value.appliedTechnologies.some(
    (technology) => technology.technologyId === 'mage_purge_field',
  ),
)
const towerDamageType = computed(() =>
  damageTypeFromGame(
    selectedTower.value.attack.damageTypeValue,
    selectedTower.value.attack.damageType,
  ),
)
const activeDamageType = computed(() =>
  attackSource.value === 'tower' ? towerDamageType.value : demoDamageType.value,
)
const activeDamageMin = computed(() =>
  attackSource.value === 'tower' ? result.value.damageMin || 0 : customDamage.min,
)
const activeDamageMax = computed(() =>
  attackSource.value === 'tower' ? result.value.damageMax || 0 : customDamage.max,
)
const appliedTechnologyIds = computed(
  () => new Set(result.value.appliedTechnologies.map((technology) => technology.technologyId)),
)
const hasSimulationTechnology = (technologyId: string) =>
  attackSource.value === 'tower' && appliedTechnologyIds.value.has(technologyId)
const technologyOnlyDamageMin = computed(() =>
  (result.value.damageMin || 0) / (1 + result.value.damageBonus),
)
const technologyOnlyDamageMax = computed(() =>
  (result.value.damageMax || 0) / (1 + result.value.damageBonus),
)
const simulationArmorReductionPerHit = computed(() => {
  if (hasSimulationTechnology('archer_tear')) {
    const averageDamage = (technologyOnlyDamageMin.value + technologyOnlyDamageMax.value) / 2
    if (averageDamage > 40) return 1
    if (averageDamage > 20) return 0.72
    if (averageDamage > 10) return 0.44
    return 0.16
  }
  if (hasSimulationTechnology('mage_arcane_shatter')) {
    return technologyOnlyDamageMax.value >= 50 ? 3.5 : 2
  }
  return 0
})
const magicDustUsesCompensation = computed(() =>
  hasSimulationTechnology('engineer_magic_dust') &&
  magicDustCompensationTowerIds.has(selectedTower.value.id),
)
const simulationTechnologyEffects = computed<SimulationTechnologyEffect[]>(() => {
  if (attackSource.value !== 'tower') return []
  const effects: SimulationTechnologyEffect[] = []
  if (hasSimulationTechnology('archer_piercing')) {
    effects.push({
      id: 'archer_piercing',
      name: '穿刺射击',
      description: '每次攻击忽略目标 10 点护甲',
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_precision')) {
    effects.push({
      id: 'archer_precision',
      name: '精准射击',
      description: '每次攻击独立有 10% 概率造成 2 倍伤害',
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_el_bloodletting_shoot')) {
    effects.push({
      id: 'archer_el_bloodletting_shoot',
      name: '放血射击',
      description: '15% 概率施加 3 秒放血：立即结算首跳，共 23 跳真实伤害，最多 5 层',
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_tear')) {
    effects.push({
      id: 'archer_tear',
      name: '护甲撕裂',
      description: `每次命中后永久降低 ${formatNumber(simulationArmorReductionPerHit.value)} 点护甲`,
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_obsidian')) {
    effects.push({
      id: 'archer_obsidian',
      name: '黑曜箭镞',
      description: '目标当前减伤不高于 10% 时，主伤害提高 27%',
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_magic')) {
    effects.push({
      id: 'archer_magic',
      name: '附魔箭矢',
      description: '每次命中追加主伤害 12% 的魔法伤害（向上取整）',
      active: true,
    })
  }
  if (hasSimulationTechnology('archer_fly_killer')) {
    effects.push({
      id: 'archer_fly_killer',
      name: '空军克星',
      description: dummy.flying ? '傀儡为空军，额外 25% 对空伤害已触发' : '仅对空军额外提高 25%；当前傀儡不是空军',
      active: dummy.flying,
    })
  }
  if (hasSimulationTechnology('mage_arcane_shatter')) {
    effects.push({
      id: 'mage_arcane_shatter',
      name: '奥术粉碎',
      description: `每次命中后永久降低 ${formatNumber(simulationArmorReductionPerHit.value)} 点护甲`,
      active: true,
    })
  }
  if (hasSimulationTechnology('mage_strike')) {
    effects.push({
      id: 'mage_strike',
      name: '弱点打击',
      description: '目标对本次伤害没有减伤时，主伤害提高 20%',
      active: true,
    })
  }
  if (hasSimulationTechnology('mage_unsteady')) {
    effects.push({
      id: 'mage_unsteady',
      name: '不稳定魔力',
      description: '每次攻击有 10% 概率造成 2 倍无减伤伤害',
      active: true,
    })
  }
  if (hasSimulationTechnology('mage_purge_field')) {
    effects.push({
      id: 'mage_purge_field',
      name: '肃清立场',
      description: `射程内 ${nearbyEnemyCount.value} 名敌人：实时伤害提高 ${14 + Math.min(30, Math.max(0, Math.floor(nearbyEnemyCount.value || 0)))}%`,
      active: true,
    })
  }
  if (hasSimulationTechnology('engineer_magic_dust')) {
    effects.push({
      id: 'engineer_magic_dust',
      name: '魔法粉尘',
      description: magicDustUsesCompensation.value
        ? '该塔使用兼容补偿规则：固定提高 20%，已计入实时伤害'
        : '每次攻击有 10% 概率追加基于本次攻击力和傀儡最大生命的伤害',
      active: true,
    })
  }
  return effects
})
const simulationArmorIgnore = computed(() =>
  simulationTechnologyEffects.value.some((technology) => technology.id === 'archer_piercing')
    ? 10
    : 0,
)
const simulationCriticalChance = computed(() =>
  simulationTechnologyEffects.value.some((technology) => technology.id === 'archer_precision')
    ? 0.1
    : 0,
)
const effectiveDummyArmor = computed(() =>
  Math.max(0, (Number(dummy.armor) || 0) - simulationArmorIgnore.value),
)
const selectedDamageType = computed(
  () =>
    damageTypeDefinitions.find((damageType) => damageType.id === activeDamageType.value) ||
    damageTypeDefinitions[0],
)
const activeCurveGroupId = computed(
  () =>
    damageCurveGroups.find((group) => group.damageTypes.includes(activeDamageType.value))?.id ||
    damageCurveGroups[0]!.id,
)
const highlightedCurveGroupId = computed(
  () => curveFocusGroupId.value || activeCurveGroupId.value,
)
const curvePlot = computed(() => {
  const compact = curveChartWidth.value < 520
  const height = compact ? 330 : 360
  return {
    width: curveChartWidth.value,
    height,
    left: compact ? 50 : 62,
    right: compact ? 12 : 18,
    top: 24,
    bottom: 48,
  }
})
const curveXTicks = computed(() =>
  curveChartWidth.value < 520 ? [0, 25, 50, 75, 100] : [0, 20, 40, 60, 80, 100],
)
const curveYTicks = [0, 50, 100, 150, 200]

function curveDamage(group: DamageCurveGroup, defense: number) {
  const damageType = group.damageTypes[0]!
  const normalizedDefense = Math.min(100, Math.max(0, Number(defense) || 0))
  return simulateDamage({
    damageType,
    damage: 100,
    hp: 10_000,
    armor: normalizedDefense,
    magicArmor:
      damageType === 'mixed'
        ? Math.min(100, Math.max(0, Number(dummy.magicArmor) || 0))
        : normalizedDefense,
  }).damageApplied
}

function curveGroupTypeNames(group: DamageCurveGroup) {
  return damageTypeDefinitions
    .filter((damageType) => group.damageTypes.includes(damageType.id))
    .map((damageType) => damageType.shortName)
    .join(' · ')
}

function curveX(defense: number) {
  const plot = curvePlot.value
  return plot.left + (defense / 100) * (plot.width - plot.left - plot.right)
}

function curveY(damage: number) {
  const plot = curvePlot.value
  return plot.top + ((200 - damage) / 200) * (plot.height - plot.top - plot.bottom)
}

function curvePath(group: DamageCurveGroup) {
  return Array.from({ length: 101 }, (_, defense) => {
    const prefix = defense === 0 ? 'M' : 'L'
    return `${prefix}${curveX(defense).toFixed(2)},${curveY(curveDamage(group, defense)).toFixed(2)}`
  }).join(' ')
}

function toggleCurveFocus(groupId: string) {
  curveFocusGroupId.value = curveFocusGroupId.value === groupId ? null : groupId
}

const damageSequence = computed(() =>
  simulateAttackSequence({
    damageType: activeDamageType.value,
    damageMin: activeDamageMin.value,
    damageMax: activeDamageMax.value,
    hp: dummy.hp,
    armor: dummy.armor,
    magicArmor: dummy.magicArmor,
    armorIgnore: simulationArmorIgnore.value,
    criticalChance: simulationCriticalChance.value,
    criticalMultiplier: 2,
    attackInterval: result.value.cooldown || 0,
    armorReductionPerHit: simulationArmorReductionPerHit.value,
    lowProtectionThreshold: hasSimulationTechnology('archer_obsidian') ? 0.1 : -1,
    lowProtectionMultiplier: hasSimulationTechnology('archer_obsidian') ? 1.27 : 1,
    unprotectedMultiplier: hasSimulationTechnology('mage_strike') ? 1.2 : 1,
    unsteadyChance: hasSimulationTechnology('mage_unsteady') ? 0.1 : 0,
    unsteadyMultiplier: 2,
    secondaryMagicDamageFactor: hasSimulationTechnology('archer_magic') ? 0.12 : 0,
    flyingDamageMultiplier:
      hasSimulationTechnology('archer_fly_killer') && dummy.flying ? 1.25 : 1,
    magicDustChance:
      hasSimulationTechnology('engineer_magic_dust') && !magicDustUsesCompensation.value
        ? 0.1
        : 0,
    bleedChance: hasSimulationTechnology('archer_el_bloodletting_shoot') ? 0.15 : 0,
    bleedDamageFactor: 0.1,
    bleedTicks: 23,
    bleedTickInterval: 4 / 30,
    bleedDuration: 3,
    bleedMaxStacks: 5,
    seed: simulationSeed.value,
  }),
)
const firstAttack = computed(() => damageSequence.value.attacks[0])
const dummyRemainingPercent = computed(() => {
  const hp = Math.max(0, Number(dummy.hp) || 0)
  return hp > 0 ? (damageSequence.value.remainingHp / hp) * 100 : 0
})
const attackPageCount = computed(() =>
  Math.max(1, Math.ceil(damageSequence.value.attacks.length / attackPageSize)),
)
const currentAttackPage = computed(() => Math.min(attackPage.value, attackPageCount.value))
const visibleAttacks = computed(() => {
  const start = (currentAttackPage.value - 1) * attackPageSize
  return damageSequence.value.attacks.slice(start, start + attackPageSize)
})
const visibleAttackRange = computed(() => {
  if (!damageSequence.value.attacks.length) return '0'
  const start = (currentAttackPage.value - 1) * attackPageSize + 1
  const end = start + visibleAttacks.value.length - 1
  return `${start}–${end}`
})
const damageEquation = computed(() => {
  const damage = firstAttack.value
  if (!damage) return '当前配置无法造成有效伤害'
  const technologyMultiplier = damage.technologyDamageMultiplier > 1
    ? ` × ${formatNumber(damage.technologyDamageMultiplier)}`
    : ''
  const typeMultiplier = activeDamageType.value === 'stab' ? ' × 2' : ''
  const extras = damage.totalAttackDamageApplied > damage.damageApplied
    ? `；附加结算后本击共 ${formatNumber(damage.totalAttackDamageApplied)}`
    : ''
  return `${formatNumber(damage.rolledDamage)}${technologyMultiplier}${typeMultiplier} × (1 − ${formatPercent(damage.protection)}) = 主伤 ${formatNumber(damage.damageApplied)}${extras}`
})
const technologyTriggerSummary = computed(() => {
  const parts: string[] = []
  if (simulationCriticalChance.value) parts.push(`精准 ${damageSequence.value.criticalHits} 次`)
  if (hasSimulationTechnology('mage_unsteady')) parts.push(`不稳定 ${damageSequence.value.unsteadyHits} 次`)
  if (hasSimulationTechnology('engineer_magic_dust') && !magicDustUsesCompensation.value) {
    parts.push(`粉尘 ${damageSequence.value.magicDustHits} 次`)
  }
  if (hasSimulationTechnology('archer_el_bloodletting_shoot')) {
    parts.push(`放血 ${damageSequence.value.bleedTriggers} 次`)
  }
  return parts.join(' · ')
})

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 1) return `${formatNumber(seconds, 3)} 秒`
  return `${formatNumber(seconds, 2)} 秒`
}

function technologyIsSimulated(technologyId: string) {
  return attackSource.value === 'tower' && supportedSimulationTechnologyIds.has(technologyId)
}

function selectedLevel(effect: SupportEffect): SupportLevel {
  return (
    effect.levels.find((level) => level.level === state[effect.id]?.level) || effect.levels[0]
  )
}

function effectSummary(effect: SupportEffect) {
  const level = selectedLevel(effect)
  const parts = []
  if (level.damageBonus) parts.push(`伤害 +${formatPercent(level.damageBonus)}`)
  if (level.damagePerTrigger) parts.push(`每次伤害 +${formatPercent(level.damagePerTrigger)}`)
  if (level.rangeBonus) parts.push(`范围 +${formatPercent(level.rangeBonus)}`)
  if (level.speedBonus) parts.push(`攻速 +${formatPercent(level.speedBonus)}`)
  if (level.cooldownMultiplier && level.cooldownMultiplier !== 1) {
    parts.push(`攻击间隔 ×${formatPercent(level.cooldownMultiplier)}`)
  }
  if (level.priceMultiplier && level.priceMultiplier !== 1) {
    parts.push(`价格 ${formatPercent(level.priceMultiplier)}`)
  }
  if (level.flatDps) parts.push(`额外 DPS +${formatNumber(level.flatDps)}`)
  return parts.join(' · ')
}

function effectIcon(effect: SupportEffect) {
  if (effect.icon) return effect.icon
  const tower = sourceById.value.get(effect.sourceTowerId || '')
  return tower?.powers.find((power) => power.id === effect.skillId)?.icon || tower?.image || ''
}

function effectSourceName(effect: SupportEffect) {
  if (effect.sourceType === 'hero') {
    return `英雄 · ${heroById.value.get(effect.sourceHeroId || '')?.name || effect.sourceHeroId}`
  }
  return `防御塔 · ${sourceById.value.get(effect.sourceTowerId || '')?.name || effect.sourceTowerId}`
}

function effectModeLabel(effect: SupportEffect) {
  return {
    aura: '常驻光环',
    temporary: '临时效果',
    triggered: '条件触发',
    passive: '全局被动',
  }[effect.mode]
}

function resetSupports() {
  Object.values(state).forEach((item) => {
    item.enabled = false
    item.triggers = 0
  })
}

function resetTechnologies() {
  technologyFamilies.forEach((family) => {
    technologyLevels[family] = 0
  })
  mageTowerCount.value = 1
  nearbyEnemyCount.value = 1
}

function resetDamageDemo() {
  attackSource.value = 'tower'
  demoDamageType.value = 'true'
  customDamage.min = 100
  customDamage.max = 100
  dummy.hp = 1000
  dummy.armor = 10
  dummy.magicArmor = 10
  dummy.flying = false
  simulationSeed.value = 2058
  curveDefense.value = 10
  curveFocusGroupId.value = null
  attackPage.value = 1
}

function selectDamageType(damageType: DamageTypeId) {
  attackSource.value = 'custom'
  demoDamageType.value = damageType
  curveFocusGroupId.value = null
  attackPage.value = 1
}

function selectAttackSource(source: 'tower' | 'custom') {
  attackSource.value = source
  attackPage.value = 1
}

function rerollDamageSequence() {
  simulationSeed.value += 9973
  attackPage.value = 1
}

function changeAttackPage(offset: number) {
  attackPage.value = Math.min(
    attackPageCount.value,
    Math.max(1, currentAttackPage.value + offset),
  )
}

onMounted(() => {
  curveResizeObserver = new ResizeObserver((entries) => {
    const width = Math.round(entries[0]?.contentRect.width || 0)
    if (width > 0) curveChartWidth.value = Math.max(280, width)
  })
  if (curveChartHost.value) curveResizeObserver.observe(curveChartHost.value)
})

onBeforeUnmount(() => {
  curveResizeObserver?.disconnect()
})
</script>

<template>
  <section class="calculator-view page-width">
    <div class="page-heading split-heading">
      <div>
        <div class="eyebrow"><span></span> AUXILIARY EFFECT LAB</div>
        <h1>辅助增益<em>计算台</em></h1>
        <p>选择科技树、塔族科技等级，以及防御塔或英雄辅助，按 Dove 脚本规则计算伤害、范围、价格和攻击间隔。</p>
      </div>
      <div class="formula-card">
        <span>叠加速记</span>
        <code>科技先修正基础值</code>
        <code>辅助伤害 Σ 加成</code>
        <code>间隔 × 科技 ÷ (1 + Σ攻速)</code>
      </div>
    </div>

    <div class="calculator-layout">
      <div class="calculator-controls">
        <section class="lab-card target-selector-card">
          <div class="lab-step"><span>01</span><div><b>选择目标塔</b><small>TARGET TOWER</small></div></div>
          <label class="tower-select-label">
            <span>防御塔</span>
            <select v-model="targetId">
              <option v-for="tower in towers" :key="tower.id" :value="tower.id">
                {{ tower.name }} · {{ tower.families.map((item) => familyLabels[item]).join('/') }} · {{ tower.id }}
              </option>
            </select>
          </label>

          <button class="selected-target" type="button" @click="$emit('open', selectedTower)">
            <span
              class="portrait-frame large"
              :class="{ 'encyclopedia-icon': selectedTower.encyclopediaListed }"
            >
              <img :src="selectedTower.image" :alt="selectedTower.name" />
            </span>
            <span>
              <small>{{ selectedTower.families.map((item) => familyLabels[item]).join(' / ') }}</small>
              <strong>{{ selectedTower.name }}</strong>
              <code>{{ selectedTower.id }}</code>
            </span>
            <b>查看档案 →</b>
          </button>
        </section>

        <section class="lab-card technology-selector-card">
          <div class="lab-step"><span>02</span><div><b>配置科技树</b><small>STAR UPGRADES</small></div></div>
          <div class="technology-controls">
            <label class="technology-tree-select">
              <span>科技方案</span>
              <select v-model.number="technologyTreeId">
                <option v-for="tree in technologyTrees" :key="tree.id" :value="tree.id">
                  {{ tree.name }} · {{ tree.technologies.length }} 项
                </option>
              </select>
            </label>
            <label v-for="family in technologyFamilies" :key="family">
              <span>{{ familyLabels[family] }}科技</span>
              <select v-model.number="technologyLevels[family]">
                <option v-for="level in technologyLevelOptions" :key="level" :value="level">
                  {{ level === 0 ? '未投入' : `最高 Lv.${level}` }}
                </option>
              </select>
            </label>
            <label v-if="needsMageTowerCount">
              <span>场上法师塔</span>
              <input v-model.number="mageTowerCount" type="number" min="1" max="9" />
            </label>
            <label v-if="needsNearbyEnemyCount">
              <span>射程内敌人</span>
              <input v-model.number="nearbyEnemyCount" type="number" min="0" max="30" />
            </label>
          </div>

          <div v-if="result.appliedTechnologies.length" class="technology-preview">
            <article
              v-for="technology in result.appliedTechnologies"
              :key="`${technology.family}-${technology.technologyId}`"
            >
              <span>Lv.{{ technology.level }}</span>
              <div>
                <strong>{{ technology.name }}</strong>
                <p>{{ technology.description }}</p>
              </div>
              <small
                :class="technology.calculated || technologyIsSimulated(technology.technologyId) ? 'calculated' : 'conditional'"
              >
                {{ technologyIsSimulated(technology.technologyId) ? '已计入逐击' : technology.calculated ? '已计入' : '条件型' }}
              </small>
            </article>
          </div>
          <p v-else class="technology-empty">当前目标塔尚未启用对应塔族科技。</p>
          <button class="text-button" type="button" @click="resetTechnologies">清空科技</button>
        </section>

        <section class="lab-card support-selector-card">
          <div class="lab-step"><span>03</span><div><b>配置辅助来源</b><small>SUPPORT SOURCES</small></div></div>
          <div class="support-list">
            <article
              v-for="effect in effects"
              :key="effect.id"
              class="support-option"
              :class="{ enabled: state[effect.id]?.enabled }"
            >
              <label class="support-toggle">
                <input v-model="state[effect.id]!.enabled" type="checkbox" />
                <span></span>
              </label>
              <img :src="effectIcon(effect)" :alt="`${effect.name}技能图标`" />
              <div class="support-copy">
                <div>
                  <strong>{{ effect.name }}</strong>
                  <small>{{ effectSourceName(effect) }}</small>
                </div>
                <p>{{ effectSummary(effect) || '条件触发型辅助' }}</p>
                <span class="effect-meta">
                  {{ selectedLevel(effect).radius ? `半径 ${selectedLevel(effect).radius}` : '全场' }}
                  · {{ effectModeLabel(effect) }}
                  <template v-if="selectedLevel(effect).duration"> · {{ selectedLevel(effect).duration }}s</template>
                </span>
              </div>
              <div class="support-inputs">
                <label>
                  <span>技能等级</span>
                  <select v-model.number="state[effect.id]!.level" :disabled="!state[effect.id]?.enabled">
                    <option v-for="level in effect.levels" :key="level.level" :value="level.level">Lv.{{ level.level }}</option>
                  </select>
                </label>
                <label v-if="selectedLevel(effect).damagePerTrigger">
                  <span>目标获益次数</span>
                  <input
                    v-model.number="state[effect.id]!.triggers"
                    type="number"
                    min="0"
                    :max="selectedLevel(effect).triggerCap"
                    :disabled="!state[effect.id]?.enabled"
                  />
                </label>
              </div>
              <p class="support-note">{{ effect.note }}</p>
            </article>
          </div>
          <button class="text-button" type="button" @click="resetSupports">清空全部辅助</button>
        </section>

        <section class="lab-card damage-lab-card">
          <div class="lab-step"><span>04</span><div><b>伤害类型与傀儡演示</b><small>DAMAGE TYPE LAB</small></div></div>
          <div class="damage-type-heading">
            <div>
              <strong>游戏伤害类型</strong>
              <p>点击类型可查看规则并立即对下方傀儡结算。百分比按游戏脚本的小数护甲换算。</p>
            </div>
            <span>{{ damageTypeDefinitions.length }} TYPES</span>
          </div>

          <div class="damage-type-grid">
            <button
              v-for="damageType in damageTypeDefinitions"
              :key="damageType.id"
              type="button"
              class="damage-type-card"
              :class="[{ active: activeDamageType === damageType.id }, `type-${damageType.id}`]"
              @click="selectDamageType(damageType.id)"
            >
              <span><i></i>{{ damageType.code }}</span>
              <strong>{{ damageType.name }}</strong>
              <p>{{ damageType.description }}</p>
              <code>{{ damageType.formula }}</code>
            </button>
          </div>

          <section class="damage-curve-lab" aria-labelledby="damage-curve-title">
            <div class="damage-curve-toolbar">
              <div>
                <strong id="damage-curve-title">伤害曲线</strong>
                <p>比较 100 点基础伤害在 0–100 点护甲或魔抗下的实际结算值；公式相同的类型合并为同一条线。</p>
              </div>
              <label class="damage-curve-slider">
                <span>查看防御值 <b>{{ curveDefense }}%</b></span>
                <input v-model.number="curveDefense" type="range" min="0" max="100" step="1" />
              </label>
            </div>

            <div class="damage-curve-legend" aria-label="伤害曲线图例">
              <button
                v-for="group in damageCurveGroups"
                :key="group.id"
                type="button"
                :class="[
                  group.className,
                  { active: highlightedCurveGroupId === group.id },
                ]"
                :aria-pressed="curveFocusGroupId === group.id"
                :aria-label="`${group.name}：${formatNumber(curveDamage(group, curveDefense))} 点实际伤害`"
                @click="toggleCurveFocus(group.id)"
              >
                <i></i>
                <span>
                  <strong>{{ group.name }}</strong>
                  <small>{{ curveGroupTypeNames(group) }}</small>
                </span>
                <b>{{ formatNumber(curveDamage(group, curveDefense)) }}</b>
              </button>
            </div>

            <div ref="curveChartHost" class="damage-curve-chart-host">
              <svg
                class="damage-curve-chart"
                :viewBox="`0 0 ${curvePlot.width} ${curvePlot.height}`"
                :width="curvePlot.width"
                :height="curvePlot.height"
                role="img"
                aria-labelledby="damage-curve-svg-title damage-curve-svg-desc"
              >
                <title id="damage-curve-svg-title">十种游戏伤害类型的防御减伤曲线</title>
                <desc id="damage-curve-svg-desc">
                  横轴为护甲或魔抗百分比，纵轴为每 100 点基础伤害实际造成的伤害。穿刺伤害基础翻倍，因此最高为 200。
                </desc>
                <rect
                  class="damage-curve-frame"
                  :x="curvePlot.left"
                  :y="curvePlot.top"
                  :width="curvePlot.width - curvePlot.left - curvePlot.right"
                  :height="curvePlot.height - curvePlot.top - curvePlot.bottom"
                />

                <g v-for="tick in curveYTicks" :key="`curve-y-${tick}`">
                  <line
                    class="damage-curve-grid-line"
                    :x1="curvePlot.left"
                    :x2="curvePlot.width - curvePlot.right"
                    :y1="curveY(tick)"
                    :y2="curveY(tick)"
                  />
                  <text
                    class="damage-curve-tick"
                    :x="curvePlot.left - 9"
                    :y="curveY(tick) + 4"
                    text-anchor="end"
                  >{{ tick }}</text>
                </g>

                <g v-for="tick in curveXTicks" :key="`curve-x-${tick}`">
                  <line
                    class="damage-curve-grid-line"
                    :x1="curveX(tick)"
                    :x2="curveX(tick)"
                    :y1="curvePlot.top"
                    :y2="curvePlot.height - curvePlot.bottom"
                  />
                  <text
                    class="damage-curve-tick"
                    :x="curveX(tick)"
                    :y="curvePlot.height - curvePlot.bottom + 19"
                    text-anchor="middle"
                  >{{ tick }}</text>
                </g>

                <text
                  class="damage-curve-axis-title"
                  :x="curvePlot.left"
                  y="14"
                >实际伤害 / 100 基础伤害</text>
                <text
                  class="damage-curve-axis-title"
                  :x="curvePlot.left + (curvePlot.width - curvePlot.left - curvePlot.right) / 2"
                  :y="curvePlot.height - 7"
                  text-anchor="middle"
                >对应护甲 / 魔抗（%）</text>

                <path
                  v-for="group in damageCurveGroups"
                  :key="`curve-path-${group.id}`"
                  class="damage-curve-series"
                  :class="[
                    group.className,
                    {
                      active: highlightedCurveGroupId === group.id,
                      dimmed: curveFocusGroupId && curveFocusGroupId !== group.id,
                    },
                  ]"
                  :d="curvePath(group)"
                />

                <line
                  class="damage-curve-cursor"
                  :x1="curveX(curveDefense)"
                  :x2="curveX(curveDefense)"
                  :y1="curvePlot.top"
                  :y2="curvePlot.height - curvePlot.bottom"
                />
                <circle
                  v-for="group in damageCurveGroups"
                  :key="`curve-point-${group.id}`"
                  class="damage-curve-point"
                  :class="[
                    group.className,
                    {
                      active: highlightedCurveGroupId === group.id,
                      dimmed: curveFocusGroupId && curveFocusGroupId !== group.id,
                    },
                  ]"
                  :cx="curveX(curveDefense)"
                  :cy="curveY(curveDamage(group, curveDefense))"
                  :r="highlightedCurveGroupId === group.id ? 4.5 : 2.5"
                />
              </svg>
            </div>

            <p class="damage-curve-note">
              混合伤害以横轴作为护甲，并固定魔抗为当前傀儡的 {{ formatNumber(dummy.magicArmor) }}%；真实伤害不受两项防御影响。点击图例可突出单条曲线。
            </p>
          </section>

          <div class="damage-demo-panel">
            <div class="damage-demo-config">
              <div class="damage-demo-title">
                <div><strong>配置攻击来源</strong><small>ATTACK SOURCE</small></div>
                <button type="button" class="text-button" @click="resetDamageDemo">恢复默认</button>
              </div>

              <div class="attack-source-switch" role="group" aria-label="攻击来源">
                <button
                  type="button"
                  :class="{ active: attackSource === 'tower' }"
                  @click="selectAttackSource('tower')"
                >
                  当前防御塔
                </button>
                <button
                  type="button"
                  :class="{ active: attackSource === 'custom' }"
                  @click="selectAttackSource('custom')"
                >
                  自定义攻击
                </button>
              </div>

              <template v-if="attackSource === 'tower'">
                <div class="tower-attack-source">
                  <img :src="selectedTower.image" :alt="selectedTower.name" />
                  <div>
                    <span>当前防御塔</span>
                    <strong>{{ selectedTower.name }}</strong>
                    <small>实时同步科技与辅助效果</small>
                  </div>
                  <dl>
                    <div>
                      <dt>伤害类型</dt>
                      <dd>{{ selectedDamageType.name }}</dd>
                    </div>
                    <div>
                      <dt>实时伤害</dt>
                      <dd>{{ formatNumber(activeDamageMin) }}–{{ formatNumber(activeDamageMax) }}</dd>
                    </div>
                  </dl>
                </div>

                <div v-if="simulationTechnologyEffects.length" class="simulation-technology-effects">
                  <div class="simulation-technology-heading">
                    <span>当前生效科技</span>
                    <small>逐击脚本结算</small>
                  </div>
                  <article
                    v-for="technology in simulationTechnologyEffects"
                    :key="technology.id"
                    :class="{ inactive: !technology.active }"
                  >
                    <i></i>
                    <div>
                      <strong>{{ technology.name }}</strong>
                      <small>{{ technology.description }}</small>
                    </div>
                  </article>
                </div>
              </template>

              <div v-else class="damage-demo-fields custom-attack-fields">
                <label>
                  <span>伤害类型</span>
                  <select v-model="demoDamageType">
                    <option
                      v-for="damageType in damageTypeDefinitions"
                      :key="damageType.id"
                      :value="damageType.id"
                    >
                      {{ damageType.name }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>最低伤害</span>
                  <input v-model.number="customDamage.min" type="number" min="0" max="999999" step="1" />
                </label>
                <label>
                  <span>最高伤害</span>
                  <input v-model.number="customDamage.max" type="number" min="0" max="999999" step="1" />
                </label>
              </div>

              <div class="damage-demo-title dummy-title">
                <div><strong>配置傀儡</strong><small>TRAINING DUMMY</small></div>
              </div>
              <div class="damage-demo-fields dummy-fields">
                <label>
                  <span>生命值</span>
                  <input v-model.number="dummy.hp" type="number" min="0" max="9999999" step="1" />
                </label>
                <label>
                  <span>护甲 (%)</span>
                  <input v-model.number="dummy.armor" type="number" min="0" max="100" step="1" />
                </label>
                <label>
                  <span>魔抗 (%)</span>
                  <input v-model.number="dummy.magicArmor" type="number" min="0" max="100" step="1" />
                </label>
              </div>
              <label class="dummy-trait-toggle">
                <input v-model="dummy.flying" type="checkbox" />
                <span></span>
                <div>
                  <strong>空军目标</strong>
                  <small>用于触发只对飞行敌人生效的科技</small>
                </div>
              </label>
              <p v-if="simulationArmorIgnore" class="dummy-effective-armor">
                穿刺射击：护甲 {{ formatNumber(Math.max(0, Number(dummy.armor) || 0)) }}% → 有效护甲 {{ formatNumber(effectiveDummyArmor) }}%
              </p>
              <p v-if="simulationArmorReductionPerHit" class="dummy-effective-armor">
                连续破甲：每次命中后降低 {{ formatNumber(simulationArmorReductionPerHit) }} 点，模拟结束时剩余 {{ formatNumber(damageSequence.finalArmor) }}% 护甲。
              </p>
            </div>

            <div class="dummy-stage" aria-live="polite">
              <div class="dummy-stage-heading">
                <div>
                  <span>结算结果</span>
                  <strong>{{ selectedDamageType.name }}</strong>
                </div>
                <b :class="{ defeated: damageSequence.defeated }">
                  {{ damageSequence.defeated ? `${damageSequence.attacks.length} 次攻击 · ${formatDuration(damageSequence.elapsedTime)}击倒` : '尚未击倒' }}
                </b>
              </div>

              <div class="dummy-hp-readout">
                <div>
                  <span>HP</span>
                  <strong>{{ formatNumber(damageSequence.remainingHp) }} / {{ formatNumber(Math.max(0, Number(dummy.hp) || 0)) }}</strong>
                </div>
                <div class="dummy-hp-track">
                  <i :style="{ width: `${dummyRemainingPercent}%` }"></i>
                </div>
              </div>

              <div class="damage-result-primary">
                <article>
                  <span>攻击次数</span>
                  <strong>{{ damageSequence.attacks.length }}</strong>
                  <small v-if="technologyTriggerSummary">{{ technologyTriggerSummary }}</small>
                  <small v-else>随机区间逐击结算</small>
                </article>
                <article>
                  <span>累计伤害</span>
                  <strong>{{ formatNumber(damageSequence.totalDamageApplied) }}</strong>
                  <small>包含最后一击溢出</small>
                </article>
                <article>
                  <span>实际扣血</span>
                  <strong>{{ formatNumber(damageSequence.totalHpLost) }}</strong>
                  <small>不超过傀儡生命</small>
                </article>
                <article>
                  <span>击杀总时长</span>
                  <strong>{{ damageSequence.defeated ? formatDuration(damageSequence.elapsedTime) : '—' }}</strong>
                  <small>
                    {{ damageSequence.finalBlow === 'bleed' ? '最后一跳放血击杀' : `首击 0 秒 · 间隔 ${formatNumber(result.cooldown)} 秒` }}
                  </small>
                </article>
              </div>

              <div class="damage-equation">
                <span>首击算式</span>
                <code>{{ damageEquation }}</code>
                <p>{{ selectedDamageType.formula }}</p>
              </div>

              <p class="damage-demo-note">
                每次攻击从 {{ formatNumber(activeDamageMin) }}–{{ formatNumber(activeDamageMax) }} 独立随机取值。首击记为 0 秒，后续按实时攻击间隔推进；不计弹道飞行与攻击前摇。演示按无免疫、无额外易伤、目标伤害系数为 1 结算；上方已启用科技会参与每次攻击。
              </p>
            </div>
          </div>

          <div class="attack-history">
            <div class="attack-history-heading">
              <div>
                <strong>逐次攻击记录</strong>
                <small>
                  HIT-BY-HIT LOG<span v-if="technologyTriggerSummary"> · {{ technologyTriggerSummary }}</span>
                </small>
              </div>
              <button type="button" @click="rerollDamageSequence">↻ 重新模拟</button>
            </div>

            <div v-if="damageSequence.attacks.length" class="attack-history-table">
              <div class="attack-history-row header-row">
                <span>攻击</span>
                <span>随机伤害</span>
                <span>本击总伤</span>
                <span>实际扣血</span>
                <span>剩余生命</span>
              </div>
              <div
                v-for="attack in visibleAttacks"
                :key="attack.index"
                class="attack-history-row"
                :class="{
                  lethal: attack.remainingHp === 0 || (attack.index === damageSequence.attacks.length && damageSequence.defeated),
                  critical: attack.critical,
                  triggered: attack.technologyTriggers.length,
                }"
              >
                <b class="attack-index">#{{ attack.index }}<small>{{ formatDuration(attack.timestamp) }}</small></b>
                <span class="attack-roll">
                  {{ formatNumber(attack.rolledDamage) }}
                  <small v-if="attack.technologyTriggers.length">{{ attack.technologyTriggers.join(' · ') }}</small>
                </span>
                <span>{{ formatNumber(attack.totalAttackDamageApplied) }}</span>
                <span>{{ formatNumber(attack.totalAttackHpLost) }}</span>
                <strong>{{ formatNumber(attack.remainingHp) }}</strong>
              </div>
            </div>

            <div v-else class="attack-history-empty">
              {{ Number(dummy.hp) <= 0 ? '傀儡初始生命为 0，无需攻击。' : '当前攻击无法造成有效伤害，傀儡不会死亡。' }}
            </div>

            <div v-if="damageSequence.attacks.length" class="attack-history-pagination">
              <span>显示第 {{ visibleAttackRange }} 次 · 共 {{ damageSequence.attacks.length }} 次</span>
              <div v-if="attackPageCount > 1">
                <button
                  type="button"
                  :disabled="currentAttackPage === 1"
                  @click="changeAttackPage(-1)"
                >
                  上一页
                </button>
                <b>{{ currentAttackPage }} / {{ attackPageCount }}</b>
                <button
                  type="button"
                  :disabled="currentAttackPage === attackPageCount"
                  @click="changeAttackPage(1)"
                >
                  下一页
                </button>
              </div>
            </div>

            <p v-if="damageSequence.truncated" class="attack-history-warning">
              10,000 次攻击后傀儡仍未死亡，记录已停止；请降低傀儡防御或生命后重试。
            </p>
            <p v-else-if="damageSequence.finalBlow === 'bleed'" class="attack-history-warning bleed-finish">
              最后一次攻击后，放血于 {{ formatDuration(damageSequence.elapsedTime) }} 完成击杀；逐击表最后一行显示该次攻击结算后的生命值。
            </p>
          </div>
        </section>
      </div>

      <aside class="result-console">
        <div class="console-heading">
          <div><span>LIVE RESULT</span><strong>实时结果</strong></div>
          <span class="live-chip"><i></i> SCRIPT RULES</span>
        </div>

        <div class="result-target-mini">
          <img :src="selectedTower.image" :alt="selectedTower.name" />
          <div><strong>{{ selectedTower.name }}</strong><code>{{ selectedTower.id }}</code></div>
          <span :class="selectedTower.canBeBuffed ? 'ok' : 'bad'">
            {{ selectedTower.canBeBuffed ? '可增益' : '不可增益' }}
          </span>
        </div>

        <div class="result-stat-list">
          <article>
            <div><span>单次伤害</span><small>DAMAGE</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.damageMin) }}–{{ formatNumber(selectedTower.attack.damageMax) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.damageMin) }}–{{ formatNumber(result.damageMax) }}</strong>
            </div>
            <em>科技 ×{{ formatNumber(result.technologyDamageMultiplier, 3) }} · 辅助 +{{ formatPercent(result.damageBonus) }}</em>
          </article>
          <article>
            <div><span>{{ result.rangeLabel }}</span><small>RANGE</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.range ?? selectedTower.attack.rallyRange) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.range) }}</strong>
            </div>
            <em>科技 ×{{ formatNumber(result.technologyRangeMultiplier, 3) }} · 辅助 ×{{ formatNumber(result.rangeMultiplier, 3) }}</em>
          </article>
          <article>
            <div><span>攻击间隔</span><small>COOLDOWN</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.cooldown) }}s</span>
              <b>→</b>
              <strong>{{ formatNumber(result.cooldown) }}s</strong>
            </div>
            <em>科技 ×{{ formatNumber(result.technologyCooldownMultiplier, 3) }} · 辅助间隔 ×{{ formatNumber(result.supportCooldownMultiplier, 3) }} · 攻速 +{{ formatPercent(result.speedBonus) }}</em>
          </article>
          <article>
            <div><span>理论 DPS</span><small>SINGLE TARGET</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.dps) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.dps) }}</strong>
            </div>
            <em v-if="result.flatDps">含英雄附着技能额外 DPS +{{ formatNumber(result.flatDps) }}</em>
            <em v-else-if="result.expectedDpsMultiplier !== 1">期望触发 ×{{ formatNumber(result.expectedDpsMultiplier, 3) }}</em>
            <em v-else>未计多目标</em>
          </article>
          <article v-if="selectedTower.price !== null">
            <div><span>建造价格</span><small>PRICE</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.price) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.price) }}</strong>
            </div>
            <em>科技修正后，英雄价格 ×{{ formatNumber(result.priceMultiplier, 3) }} 并向下取整</em>
          </article>
        </div>

        <div v-if="result.soldier" class="soldier-result">
          <div class="section-title"><span>驻防单位</span><small>TECH MODIFIED</small></div>
          <div>
            <span>人数 <b>{{ formatNumber(result.soldier.count) }}</b></span>
            <span>生命 <b>{{ formatNumber(result.soldier.hp) }}</b></span>
            <span>护甲 <b>{{ formatPercent(result.soldier.armor || 0) }}</b></span>
            <span>魔抗 <b>{{ formatPercent(result.soldier.magicArmor || 0) }}</b></span>
            <span>重生 <b>{{ formatNumber(result.soldier.respawn) }}s</b></span>
          </div>
        </div>

        <div class="applied-effects">
          <div class="section-title"><span>已应用辅助</span><small>{{ result.applied.length }} 项</small></div>
          <div v-if="result.applied.length" class="applied-list">
            <div v-for="item in result.applied" :key="item.effectId">
              <span>{{ item.name }} · Lv.{{ item.level }}</span>
              <b>{{ item.radius ? `覆盖半径 ${item.radius}` : '全场生效' }}</b>
            </div>
          </div>
          <p v-else>启用辅助技能后，这里会列出实际参与计算的效果。</p>
        </div>

        <div v-if="result.warning" class="console-warning">{{ result.warning }}</div>
        <div class="console-footnote">
          <b>计算口径</b>
          <p>科技先修正游戏基础模板，再叠加防御塔与英雄辅助。临时和条件触发效果显示生效期间的峰值，并在效果卡中保留持续时间与触发条件。</p>
        </div>
      </aside>
    </div>
  </section>
</template>
