<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { familyLabels } from '../data'
import {
  calculateBuffs,
  formatNumber,
  formatPercent,
  type SupportSelection,
  type TechnologySelection,
} from '../lib/calculator'
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

const technologyFamilies: TowerFamily[] = ['archer', 'barrack', 'mage', 'engineer']
const targetId = ref('tower_ranger')
const technologyTreeId = ref(props.technologyTrees[0]?.id || 1)
const technologyLevels = reactive<Record<TowerFamily, number>>({
  archer: 0,
  barrack: 0,
  mage: 0,
  engineer: 0,
})
const mageTowerCount = ref(1)
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
}
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
              <small :class="technology.calculated ? 'calculated' : 'conditional'">
                {{ technology.calculated ? '已计入' : '条件型' }}
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
