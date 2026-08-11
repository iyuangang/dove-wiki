<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { familyLabels } from '../data'
import {
  calculateBuffs,
  formatNumber,
  formatPercent,
  type SupportSelection,
} from '../lib/calculator'
import type { SupportEffect, SupportLevel, Tower } from '../types'

const props = defineProps<{ towers: Tower[]; effects: SupportEffect[] }>()
defineEmits<{ open: [tower: Tower] }>()

interface EffectState {
  enabled: boolean
  level: number
  triggers: number
}

const targetId = ref('tower_ranger')
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
const selectedEffects = computed<SupportSelection[]>(() =>
  props.effects
    .filter((effect) => state[effect.id]?.enabled)
    .map((effect) => ({
      effectId: effect.id,
      level: state[effect.id]?.level || 1,
      triggers: state[effect.id]?.triggers || 0,
    })),
)
const result = computed(() =>
  calculateBuffs(selectedTower.value, props.effects, selectedEffects.value),
)
const sourceById = computed(() => new Map(props.towers.map((tower) => [tower.id, tower])))

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
  return parts.join(' · ')
}

function reset() {
  Object.values(state).forEach((item) => {
    item.enabled = false
    item.triggers = 0
  })
}
</script>

<template>
  <section class="calculator-view page-width">
    <div class="page-heading split-heading">
      <div>
        <div class="eyebrow"><span></span> AUXILIARY EFFECT LAB</div>
        <h1>辅助增益<em>计算台</em></h1>
        <p>选择目标塔和技能等级，按 Dove 脚本真实叠加规则计算伤害、范围与攻击间隔。</p>
      </div>
      <div class="formula-card">
        <span>叠加速记</span>
        <code>伤害 Σ 加成</code>
        <code>范围 Π 倍率</code>
        <code>间隔 ÷ (1 + Σ攻速)</code>
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

        <section class="lab-card support-selector-card">
          <div class="lab-step"><span>02</span><div><b>配置辅助来源</b><small>SUPPORT SOURCES</small></div></div>
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
              <img :src="sourceById.get(effect.sourceTowerId)?.image" :alt="effect.name" />
              <div class="support-copy">
                <div>
                  <strong>{{ effect.name }}</strong>
                  <small>{{ sourceById.get(effect.sourceTowerId)?.name }}</small>
                </div>
                <p>{{ effectSummary(effect) || '条件触发型辅助' }}</p>
                <span class="effect-meta">
                  半径 {{ selectedLevel(effect).radius }}
                  <template v-if="effect.mode === 'temporary'"> · 临时效果</template>
                  <template v-if="effect.mode === 'triggered'"> · 击杀触发</template>
                </span>
              </div>
              <div class="support-inputs">
                <label>
                  <span>技能等级</span>
                  <select v-model.number="state[effect.id]!.level" :disabled="!state[effect.id]?.enabled">
                    <option v-for="level in effect.levels" :key="level.level" :value="level.level">Lv.{{ level.level }}</option>
                  </select>
                </label>
                <label v-if="effect.mode === 'triggered'">
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
          <button class="text-button" type="button" @click="reset">清空全部辅助</button>
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
            <em>+{{ formatPercent(result.damageBonus) }}</em>
          </article>
          <article>
            <div><span>{{ result.rangeLabel }}</span><small>RANGE</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.range ?? selectedTower.attack.rallyRange) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.range) }}</strong>
            </div>
            <em>×{{ formatNumber(result.rangeMultiplier, 3) }}</em>
          </article>
          <article>
            <div><span>攻击间隔</span><small>COOLDOWN</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.cooldown) }}s</span>
              <b>→</b>
              <strong>{{ formatNumber(result.cooldown) }}s</strong>
            </div>
            <em>攻速 +{{ formatPercent(result.speedBonus) }}</em>
          </article>
          <article>
            <div><span>理论 DPS</span><small>SINGLE TARGET</small></div>
            <div class="before-after">
              <span>{{ formatNumber(selectedTower.attack.dps) }}</span>
              <b>→</b>
              <strong>{{ formatNumber(result.dps) }}</strong>
            </div>
            <em>未计多目标</em>
          </article>
        </div>

        <div class="applied-effects">
          <div class="section-title"><span>已应用效果</span><small>{{ result.applied.length }} 项</small></div>
          <div v-if="result.applied.length" class="applied-list">
            <div v-for="item in result.applied" :key="item.effectId">
              <span>{{ item.name }} · Lv.{{ item.level }}</span>
              <b>覆盖半径 {{ item.radius }}</b>
            </div>
          </div>
          <p v-else>启用左侧辅助技能后，这里会列出实际参与计算的效果。</p>
        </div>

        <div v-if="result.warning" class="console-warning">{{ result.warning }}</div>
        <div class="console-footnote">
          <b>计算口径</b>
          <p>不含科技树、英雄与地图效果。临时辅助显示生效期间峰值；黑暗精灵显示目标实际获益指定次数后的潜在值。</p>
        </div>
      </aside>
    </div>
  </section>
</template>
