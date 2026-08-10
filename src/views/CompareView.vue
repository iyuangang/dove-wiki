<script setup lang="ts">
import { computed, ref } from 'vue'
import { familyLabels } from '../data'
import { formatNumber } from '../lib/calculator'
import type { Tower } from '../types'

const props = defineProps<{ towers: Tower[] }>()
defineEmits<{ open: [tower: Tower] }>()

const leftId = ref('tower_ranger')
const rightId = ref('tower_high_elven')
const left = computed(() => props.towers.find((tower) => tower.id === leftId.value) || props.towers[0])
const right = computed(() => props.towers.find((tower) => tower.id === rightId.value) || props.towers[1])

function statClass(leftValue: number | null, rightValue: number | null, side: 'left' | 'right', lower = false) {
  if (leftValue === null || rightValue === null || leftValue === rightValue) return ''
  const leftWins = lower ? leftValue < rightValue : leftValue > rightValue
  return (side === 'left' && leftWins) || (side === 'right' && !leftWins) ? 'winner' : ''
}
</script>

<template>
  <section class="compare-view page-width">
    <div class="page-heading centered-heading">
      <div class="eyebrow"><span></span> SIDE-BY-SIDE DOSSIER <span></span></div>
      <h1>双塔<em>并列对比</em></h1>
      <p>基础数值按同一无科技、无英雄、无地图加成口径展示；高亮表示该行数值更优。</p>
    </div>

    <div class="compare-picker-grid">
      <label class="compare-picker left">
        <span>左侧防御塔</span>
        <select v-model="leftId">
          <option v-for="tower in towers" :key="tower.id" :value="tower.id">{{ tower.name }} · {{ tower.id }}</option>
        </select>
      </label>
      <div class="versus-mark">VS</div>
      <label class="compare-picker right">
        <span>右侧防御塔</span>
        <select v-model="rightId">
          <option v-for="tower in towers" :key="tower.id" :value="tower.id">{{ tower.name }} · {{ tower.id }}</option>
        </select>
      </label>
    </div>

    <div class="compare-board">
      <button class="compare-tower-head left" type="button" @click="$emit('open', left)">
        <div class="compare-portrait"><img :src="left.image" :alt="left.name" /></div>
        <div>
          <small>{{ left.families.map((family) => familyLabels[family]).join(' / ') }}</small>
          <h2>{{ left.name }}</h2>
          <code>{{ left.id }}</code>
        </div>
      </button>
      <div class="compare-center-title">基础面板</div>
      <button class="compare-tower-head right" type="button" @click="$emit('open', right)">
        <div>
          <small>{{ right.families.map((family) => familyLabels[family]).join(' / ') }}</small>
          <h2>{{ right.name }}</h2>
          <code>{{ right.id }}</code>
        </div>
        <div class="compare-portrait"><img :src="right.image" :alt="right.name" /></div>
      </button>

      <div class="compare-value" :class="statClass(left.attack.damageMin, right.attack.damageMin, 'left')">
        {{ formatNumber(left.attack.damageMin) }}–{{ formatNumber(left.attack.damageMax) }}
      </div>
      <div class="compare-label"><span>单次伤害</span><small>{{ left.attack.scope === right.attack.scope ? left.attack.scope : '基础口径' }}</small></div>
      <div class="compare-value" :class="statClass(left.attack.damageMin, right.attack.damageMin, 'right')">
        {{ formatNumber(right.attack.damageMin) }}–{{ formatNumber(right.attack.damageMax) }}
      </div>

      <div class="compare-value" :class="statClass(left.attack.dps, right.attack.dps, 'left')">{{ formatNumber(left.attack.dps) }}</div>
      <div class="compare-label"><span>理论 DPS</span><small>单目标</small></div>
      <div class="compare-value" :class="statClass(left.attack.dps, right.attack.dps, 'right')">{{ formatNumber(right.attack.dps) }}</div>

      <div class="compare-value" :class="statClass(left.attack.cooldown, right.attack.cooldown, 'left', true)">{{ formatNumber(left.attack.cooldown) }}s</div>
      <div class="compare-label"><span>攻击间隔</span><small>越低越快</small></div>
      <div class="compare-value" :class="statClass(left.attack.cooldown, right.attack.cooldown, 'right', true)">{{ formatNumber(right.attack.cooldown) }}s</div>

      <div class="compare-value" :class="statClass(left.attack.range ?? left.attack.rallyRange, right.attack.range ?? right.attack.rallyRange, 'left')">
        {{ formatNumber(left.attack.range ?? left.attack.rallyRange) }}
      </div>
      <div class="compare-label"><span>范围</span><small>兵营为集结范围</small></div>
      <div class="compare-value" :class="statClass(left.attack.range ?? left.attack.rallyRange, right.attack.range ?? right.attack.rallyRange, 'right')">
        {{ formatNumber(right.attack.range ?? right.attack.rallyRange) }}
      </div>

      <div class="compare-value text">{{ left.attack.damageType }}</div>
      <div class="compare-label"><span>伤害类型</span><small>脚本位标记</small></div>
      <div class="compare-value text">{{ right.attack.damageType }}</div>

      <div class="compare-value text">{{ left.price ?? '—' }}</div>
      <div class="compare-label"><span>建造价格</span><small>基础配置</small></div>
      <div class="compare-value text">{{ right.price ?? '—' }}</div>

      <div class="compare-value tags"><span v-for="role in left.roles" :key="role">{{ role }}</span></div>
      <div class="compare-label"><span>定位标签</span><small>可多选</small></div>
      <div class="compare-value tags"><span v-for="role in right.roles" :key="role">{{ role }}</span></div>

      <div class="compare-value unlock-copy" :class="`unlock-${left.unlock.status}`">{{ left.unlock.label }}</div>
      <div class="compare-label"><span>解锁状态</span><small>以关卡脚本为准</small></div>
      <div class="compare-value unlock-copy" :class="`unlock-${right.unlock.status}`">{{ right.unlock.label }}</div>
    </div>

    <div class="compare-note">
      <b>阅读提示</b>
      <p>范围伤害的目标数量、兵营人数、技能触发条件与控制收益没有被强行合并成一个总 DPS。点击任一塔头像可查看完整技能和来源。</p>
    </div>
  </section>
</template>
