<script setup lang="ts">
import { familyLabels } from '../data'
import { formatNumber } from '../lib/calculator'
import type { Tower } from '../types'

defineProps<{ tower: Tower }>()
defineEmits<{ open: [tower: Tower] }>()
</script>

<template>
  <article class="tower-card" :class="`unlock-${tower.unlock.status}`">
    <button class="card-hit-area" type="button" @click="$emit('open', tower)">
      <div class="tower-card-top">
        <div class="portrait-frame">
          <img :src="tower.image" :alt="`${tower.name}头像`" loading="lazy" />
          <span class="portrait-level">{{ tower.level ?? '·' }}</span>
        </div>
        <div class="tower-card-heading">
          <div class="family-line">
            <span v-for="family in tower.families" :key="family" :class="`family-${family}`">
              {{ familyLabels[family] }}
            </span>
          </div>
          <h3>{{ tower.name }}</h3>
          <code>{{ tower.id }}</code>
        </div>
      </div>

      <p class="tower-description">{{ tower.description }}</p>

      <div class="tag-row">
        <span v-for="role in tower.roles.slice(0, 4)" :key="role" class="role-tag">{{ role }}</span>
        <span v-if="tower.roles.length > 4" class="role-tag muted">+{{ tower.roles.length - 4 }}</span>
      </div>

      <div class="card-stats">
        <div>
          <small>基础伤害</small>
          <strong v-if="tower.attack.damageMin !== null">
            {{ formatNumber(tower.attack.damageMin) }}–{{ formatNumber(tower.attack.damageMax) }}
          </strong>
          <strong v-else>特殊机制</strong>
        </div>
        <div>
          <small>{{ tower.attack.range === null ? '集结范围' : '攻击范围' }}</small>
          <strong>{{ formatNumber(tower.attack.range ?? tower.attack.rallyRange) }}</strong>
        </div>
        <div>
          <small>攻击间隔</small>
          <strong>{{ formatNumber(tower.attack.cooldown) }}<template v-if="tower.attack.cooldown">s</template></strong>
        </div>
      </div>

      <div class="unlock-line">
        <span class="unlock-icon" aria-hidden="true"></span>
        <span>{{ tower.unlock.label }}</span>
        <b aria-hidden="true">→</b>
      </div>
    </button>
  </article>
</template>
