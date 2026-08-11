<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { Enemy } from '../types'

const props = defineProps<{ enemies: Enemy[] }>()

const query = ref('')
const sourceGame = ref(0)
const movement = ref('all')
const rank = ref('all')
const defense = ref('all')
const selectedEnemy = ref<Enemy | null>(null)
const sourceNames: Record<number, string> = {
  1: '王国保卫战',
  2: '前线',
  3: '起源',
  5: '联盟',
}

const sourceGames = computed(() =>
  [...new Set(props.enemies.map((enemy) => enemy.sourceGame))].sort((left, right) => left - right),
)
const uniqueEnemyCount = computed(() => new Set(props.enemies.map((enemy) => enemy.id)).size)
const bossCount = computed(() => props.enemies.filter((enemy) => enemy.boss).length)
const flyingCount = computed(() => props.enemies.filter((enemy) => enemy.flying).length)
const filteredEnemies = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return props.enemies.filter((enemy) => {
    if (sourceGame.value && enemy.sourceGame !== sourceGame.value) return false
    if (movement.value === 'ground' && enemy.flying) return false
    if (movement.value === 'flying' && !enemy.flying) return false
    if (rank.value === 'boss' && !enemy.boss) return false
    if (rank.value === 'regular' && enemy.boss) return false
    if (defense.value === 'armor' && !(enemy.stats.armor && enemy.stats.armor > 0)) return false
    if (defense.value === 'magic' && !(enemy.stats.magicArmor && enemy.stats.magicArmor > 0)) return false
    return !needle || [enemy.name, enemy.id, enemy.description, enemy.special, ...enemy.traits]
      .some((text) => text.toLowerCase().includes(needle))
  })
})

function clearFilters() {
  query.value = ''
  sourceGame.value = 0
  movement.value = 'all'
  rank.value = 'all'
  defense.value = 'all'
}

function numberLabel(value: number | null, digits = 2) {
  if (value == null) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value)
}

function damageLabel(enemy: Enemy) {
  if (enemy.stats.damageMin == null || enemy.stats.damageMax == null) return '—'
  return enemy.stats.damageMin === enemy.stats.damageMax
    ? numberLabel(enemy.stats.damageMin)
    : `${numberLabel(enemy.stats.damageMin)}–${numberLabel(enemy.stats.damageMax)}`
}

function percentLabel(value: number | null) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}
</script>

<template>
  <section class="enemy-view page-width">
    <div class="page-heading split-heading enemy-page-heading">
      <div>
        <div class="eyebrow"><span></span> ENEMY ENCYCLOPEDIA</div>
        <h1>敌人百科<em>档案</em></h1>
        <p>严格按游戏内百科顺序整理敌人图像、介绍与六项面板属性。重复槽位也予以保留，以忠实呈现当前游戏版本。</p>
      </div>
      <div class="enemy-ledger">
        <span><strong>{{ enemies.length }}</strong><small>百科槽位</small></span>
        <span><strong>{{ uniqueEnemyCount }}</strong><small>唯一敌人</small></span>
        <span><strong>{{ bossCount }}</strong><small>首领槽位</small></span>
        <span><strong>{{ flyingCount }}</strong><small>飞行槽位</small></span>
      </div>
    </div>

    <section class="enemy-toolbar">
      <label class="enemy-search">
        <span>搜索敌人、内部 ID 或能力</span>
        <input v-model="query" type="search" placeholder="例如：哥布林 / 飞行 / enemy_goblin" />
      </label>
      <label>
        <span>来源作品</span>
        <select v-model="sourceGame">
          <option :value="0">全部作品</option>
          <option v-for="game in sourceGames" :key="game" :value="game">
            {{ sourceNames[game] || `作品 ${game}` }}
          </option>
        </select>
      </label>
      <label>
        <span>移动方式</span>
        <select v-model="movement">
          <option value="all">全部</option>
          <option value="ground">地面</option>
          <option value="flying">飞行</option>
        </select>
      </label>
      <label>
        <span>敌人等级</span>
        <select v-model="rank">
          <option value="all">全部</option>
          <option value="regular">普通敌人</option>
          <option value="boss">首领</option>
        </select>
      </label>
      <label>
        <span>防御类型</span>
        <select v-model="defense">
          <option value="all">全部</option>
          <option value="armor">具有护甲</option>
          <option value="magic">具有魔抗</option>
        </select>
      </label>
    </section>

    <div class="enemy-results-line">
      <span>显示 {{ filteredEnemies.length }} / {{ enemies.length }} 个百科槽位</span>
      <button
        v-if="query || sourceGame || movement !== 'all' || rank !== 'all' || defense !== 'all'"
        type="button"
        @click="clearFilters"
      >清除筛选</button>
    </div>

    <div class="enemy-grid">
      <article v-for="enemy in filteredEnemies" :key="enemy.entryId" class="enemy-card">
        <button type="button" class="enemy-card-hit" @click="selectedEnemy = enemy">
          <div class="enemy-thumb-frame">
            <img :src="enemy.thumbnail" :alt="`${enemy.name}百科缩略图`" loading="lazy" />
            <span>#{{ String(enemy.order).padStart(3, '0') }}</span>
          </div>
          <div class="enemy-card-copy">
            <div class="enemy-card-title">
              <div><h2>{{ enemy.name }}</h2><code>{{ enemy.id }}</code></div>
              <Badge variant="outline">{{ sourceNames[enemy.sourceGame] || `KR ${enemy.sourceGame}` }}</Badge>
            </div>
            <div class="enemy-badges">
              <Badge v-if="enemy.boss" variant="destructive">首领</Badge>
              <Badge v-if="enemy.flying" variant="secondary">飞行</Badge>
              <Badge v-if="enemy.stats.armor && enemy.stats.armor > 0" variant="outline">护甲 {{ percentLabel(enemy.stats.armor) }}</Badge>
              <Badge v-if="enemy.stats.magicArmor && enemy.stats.magicArmor > 0" variant="outline">魔抗 {{ percentLabel(enemy.stats.magicArmor) }}</Badge>
            </div>
            <p>{{ enemy.description }}</p>
            <dl class="enemy-card-stats">
              <div><dt>生命</dt><dd>{{ numberLabel(enemy.stats.hp) }}</dd></div>
              <div><dt>伤害</dt><dd>{{ damageLabel(enemy) }}</dd></div>
              <div><dt>速度</dt><dd>{{ numberLabel(enemy.stats.speed) }}</dd></div>
              <div><dt>扣除生命</dt><dd>{{ numberLabel(enemy.stats.lives) }}</dd></div>
            </dl>
            <div v-if="enemy.traits.length" class="enemy-traits">
              <span v-for="trait in enemy.traits.slice(0, 3)" :key="trait">{{ trait }}</span>
            </div>
          </div>
        </button>
      </article>
    </div>

    <div v-if="!filteredEnemies.length" class="empty-state">
      <strong>没有符合条件的敌人</strong>
      <p>换一个关键词或清除筛选后再试。</p>
    </div>

    <div v-if="selectedEnemy" class="enemy-detail-overlay" role="presentation" @click="selectedEnemy = null">
      <aside class="enemy-detail-panel" role="dialog" aria-modal="true" :aria-label="`${selectedEnemy.name}详情`" @click.stop>
        <Button type="button" variant="ghost" class="enemy-detail-close" aria-label="关闭敌人详情" @click="selectedEnemy = null">×</Button>
        <div class="enemy-detail-hero">
          <div class="enemy-detail-image">
            <img :src="selectedEnemy.image" :alt="`${selectedEnemy.name}百科图`" />
            <span>#{{ String(selectedEnemy.order).padStart(3, '0') }}</span>
          </div>
          <div>
            <div class="eyebrow"><span></span> {{ sourceNames[selectedEnemy.sourceGame] }}</div>
            <h2>{{ selectedEnemy.name }}</h2>
            <code>{{ selectedEnemy.id }}</code>
            <div class="enemy-badges">
              <Badge v-if="selectedEnemy.boss" variant="destructive">首领</Badge>
              <Badge v-if="selectedEnemy.flying" variant="secondary">飞行单位</Badge>
            </div>
          </div>
        </div>

        <p class="enemy-detail-description">{{ selectedEnemy.description }}</p>
        <p v-if="selectedEnemy.special" class="enemy-special">特殊能力：{{ selectedEnemy.special }}</p>

        <dl class="enemy-detail-stats">
          <div><dt>生命值</dt><dd>{{ numberLabel(selectedEnemy.stats.hp) }}</dd></div>
          <div><dt>攻击伤害</dt><dd>{{ damageLabel(selectedEnemy) }}</dd></div>
          <div><dt>物理护甲</dt><dd>{{ percentLabel(selectedEnemy.stats.armor) }}</dd></div>
          <div><dt>魔法抗性</dt><dd>{{ percentLabel(selectedEnemy.stats.magicArmor) }}</dd></div>
          <div><dt>移动速度</dt><dd>{{ numberLabel(selectedEnemy.stats.speed) }}</dd></div>
          <div><dt>扣除生命</dt><dd>{{ numberLabel(selectedEnemy.stats.lives) }}</dd></div>
          <div><dt>击杀金币</dt><dd>{{ numberLabel(selectedEnemy.stats.gold) }}</dd></div>
        </dl>

        <section v-if="selectedEnemy.traits.length" class="enemy-detail-traits">
          <strong>百科特征</strong>
          <ul><li v-for="trait in selectedEnemy.traits" :key="trait">{{ trait }}</li></ul>
        </section>

        <section class="enemy-detail-source">
          <strong>数据来源</strong>
          <code>{{ selectedEnemy.sources.roster }}</code>
          <code>{{ selectedEnemy.sources.encyclopedia }}</code>
        </section>
      </aside>
    </div>
  </section>
</template>
