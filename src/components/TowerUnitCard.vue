<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatNumber } from '../lib/calculator'
import type { TowerUnit } from '../types'

const props = defineProps<{ unit: TowerUnit; relatedSkills: string[] }>()
const selectedLevel = ref(props.unit.variants[0]?.level ?? 0)
const stats = computed(() => props.unit.variants.find((variant) => variant.level === selectedLevel.value) || props.unit.stats)
const percent = (value: number | null) => value === null ? '—' : `${formatNumber(value * 100)}%`
</script>

<template>
  <article class="unit-card">
    <header class="unit-card-heading">
      <div>
        <h3>{{ unit.name }}</h3>
        <span>{{ unit.controllable ? '可调集单位' : '关联单位' }}<template v-if="unit.count !== null"> · {{ unit.count }} 名</template></span>
      </div>
      <label v-if="unit.variants.length > 1" class="unit-level-select">
        技能等级
        <select v-model="selectedLevel" :aria-label="`${unit.name}技能等级`">
          <option v-for="variant in unit.variants" :key="variant.level" :value="variant.level">{{ variant.label }}</option>
        </select>
      </label>
      <span v-else-if="unit.variants.length" class="unit-level-label">{{ unit.variants[0]?.label }}</span>
      <span v-else class="unit-level-label">模板基准</span>
    </header>
    <p v-if="relatedSkills.length" class="unit-skill-note">关联技能：{{ relatedSkills.join('、') }}</p>
    <dl class="unit-stat-grid">
      <div><dt>生命</dt><dd>{{ formatNumber(stats.hp) }}</dd></div>
      <div><dt>物理护甲</dt><dd>{{ percent(stats.armor) }}</dd></div>
      <div><dt>魔法护甲</dt><dd>{{ percent(stats.magicArmor) }}</dd></div>
      <div><dt>移动速度</dt><dd>{{ formatNumber(stats.speed) }}</dd></div>
      <div v-if="unit.rallyRange !== null"><dt>集结范围</dt><dd>{{ formatNumber(unit.rallyRange) }}</dd></div>
      <div v-if="stats.respawn !== null"><dt>复活等待</dt><dd>{{ formatNumber(stats.respawn) }} 秒</dd></div>
      <div v-if="stats.regen !== null"><dt>恢复生命</dt><dd>{{ formatNumber(stats.regen) }} / {{ formatNumber(stats.regenCooldown) }} 秒</dd></div>
      <div v-if="stats.lifetime !== null && stats.lifetime > 0"><dt>存在时间</dt><dd>{{ formatNumber(stats.lifetime) }} 秒</dd></div>
    </dl>
    <div v-if="stats.attacks.length" class="unit-attacks">
      <div v-for="attack in stats.attacks" :key="attack.id" class="unit-attack" :class="{ 'attack-disabled': attack.disabled }">
        <div class="unit-attack-title">
          <strong>{{ attack.name }}<template v-if="attack.radius"> · 范围攻击</template></strong>
          <span v-if="attack.disabled">尚未启用</span>
          <span v-else>{{ attack.damageType }}</span>
        </div>
        <div class="unit-attack-values">
          <span>单次伤害 <b>{{ formatNumber(attack.damageMin) }}–{{ formatNumber(attack.damageMax) }}</b></span>
          <span>间隔 <b>{{ formatNumber(attack.cooldown) }} 秒</b></span>
          <span v-if="attack.range !== null">范围 <b>{{ formatNumber(attack.range) }}</b></span>
          <span v-if="attack.radius !== null">伤害半径 <b>{{ formatNumber(attack.radius) }}</b></span>
          <span v-if="attack.targets !== null">目标上限 <b>{{ attack.targets }}</b></span>
          <span v-if="attack.chance !== null && attack.chance < 1">触发概率 <b>{{ percent(attack.chance) }}</b></span>
        </div>
      </div>
    </div>
    <p class="unit-footnote">{{ unit.note }}攻击间隔不含走位与动画等待。</p>
    <details class="unit-source">
      <summary>数值来源</summary>
      <code>{{ unit.id }}</code>
      <span>{{ unit.source || '运行时模板' }}<template v-if="unit.scriptSource"> · {{ unit.scriptSource }}</template></span>
    </details>
  </article>
</template>
