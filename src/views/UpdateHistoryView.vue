<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '../components/ui/badge'
import type {
  GameChangeCategory,
  GameChangeKind,
  GameChangelog,
} from '../types'

const props = defineProps<{ history: GameChangelog }>()

type CategoryFilter = 'all' | GameChangeCategory
type KindFilter = 'all' | GameChangeKind

const query = ref('')
const categoryFilter = ref<CategoryFilter>('all')
const kindFilter = ref<KindFilter>('all')

const categoryOptions: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '全部内容' },
  { id: 'hero', label: '英雄' },
  { id: 'tower', label: '防御塔' },
  { id: 'enemy', label: '敌人' },
  { id: 'technology', label: '科技' },
]
const kindOptions: Array<{ id: KindFilter; label: string }> = [
  { id: 'all', label: '全部类型' },
  { id: 'added', label: '新增' },
  { id: 'removed', label: '移除' },
  { id: 'balance', label: '数值调整' },
  { id: 'content', label: '内容调整' },
]
const categoryLabels: Record<GameChangeCategory, string> = {
  hero: '英雄',
  tower: '防御塔',
  enemy: '敌人',
  technology: '科技',
}
const kindLabels: Record<GameChangeKind, string> = {
  added: '新增',
  removed: '移除',
  balance: '数值调整',
  content: '内容调整',
}

const allChanges = computed(() => props.history.releases.flatMap((release) => release.changes))
const latestRelease = computed(() => props.history.releases[0])
const filteredReleases = computed(() => {
  const search = query.value.trim().toLowerCase()
  return props.history.releases
    .map((release) => ({
      ...release,
      changes: release.changes.filter((change) => {
        if (categoryFilter.value !== 'all' && change.category !== categoryFilter.value) return false
        if (kindFilter.value !== 'all' && change.kind !== kindFilter.value) return false
        if (!search) return true
        return [
          change.entityName,
          change.entityId,
          change.title,
          change.description,
          ...change.details.flatMap((detail) => [detail.field, detail.before, detail.after]),
        ].some((value) => value.toLowerCase().includes(search))
      }),
    }))
    .filter((release) => release.changes.length)
})

function categoryCount(category: CategoryFilter) {
  if (category === 'all') return allChanges.value.length
  return allChanges.value.filter((change) => change.category === category).length
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <section class="update-history-view page-width">
    <div class="page-heading split-heading update-heading">
      <div>
        <div class="eyebrow"><span></span> GAME UPDATE ARCHIVE</div>
        <h1>游戏更新<em>记录</em></h1>
        <p>逐版本对比游戏数据快照，记录英雄、防御塔、敌人与科技的新增、移除、数值及说明变化。后续同步新游戏版本时会自动生成差异。</p>
      </div>
      <div class="update-ledger" aria-label="更新记录概览">
        <span><strong>{{ history.releases.length }}</strong><small>次已记录更新</small></span>
        <span><strong>{{ allChanges.length }}</strong><small>组数据变化</small></span>
        <span><strong>v{{ latestRelease?.version || '—' }}</strong><small>最新游戏版本</small></span>
      </div>
    </div>

    <div class="update-toolbar">
      <label class="update-search">
        <span>搜索更新内容</span>
        <input v-model="query" type="search" placeholder="英雄、塔、技能或数值字段…" />
      </label>
      <div class="update-filter-group" aria-label="内容分类">
        <small>内容</small>
        <button
          v-for="option in categoryOptions"
          :key="option.id"
          type="button"
          :class="{ active: categoryFilter === option.id }"
          @click="categoryFilter = option.id"
        >
          {{ option.label }} <span>{{ categoryCount(option.id) }}</span>
        </button>
      </div>
      <div class="update-filter-group" aria-label="变化类型">
        <small>类型</small>
        <button
          v-for="option in kindOptions"
          :key="option.id"
          type="button"
          :class="{ active: kindFilter === option.id }"
          @click="kindFilter = option.id"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="filteredReleases.length" class="release-timeline">
      <article v-for="release in filteredReleases" :key="release.id" class="release-entry">
        <span class="release-marker" aria-hidden="true"></span>
        <header class="release-header">
          <div>
            <small>GAME BUILD</small>
            <h2>v{{ release.version }}</h2>
            <p>由 v{{ release.previousVersion }} 更新 · {{ formatDate(release.detectedAt) }}</p>
          </div>
          <div class="release-metadata">
            <Badge variant="outline">{{ release.changes.length }} / {{ release.summary.changeCount }} 组变化</Badge>
            <code>{{ release.commitHash.slice(0, 12) }}</code>
          </div>
        </header>

        <div class="release-summary-row">
          <span><b>{{ release.summary.kindCounts.added }}</b> 新增</span>
          <span><b>{{ release.summary.kindCounts.removed }}</b> 移除</span>
          <span><b>{{ release.summary.kindCounts.balance }}</b> 数值调整</span>
          <span><b>{{ release.summary.kindCounts.content }}</b> 内容调整</span>
        </div>

        <div class="release-change-list">
          <article
            v-for="change in release.changes"
            :key="change.id"
            class="update-change-card"
            :class="`change-kind-${change.kind}`"
          >
            <div class="change-entity-visual">
              <img v-if="change.image" :src="change.image" :alt="change.entityName" loading="lazy" />
              <span v-else>{{ categoryLabels[change.category].slice(0, 1) }}</span>
            </div>
            <div class="change-copy">
              <div class="change-title-row">
                <div>
                  <small>{{ categoryLabels[change.category] }} · {{ change.entityId }}</small>
                  <h3>{{ change.title }}</h3>
                </div>
                <Badge :variant="change.kind === 'added' ? 'secondary' : 'outline'">
                  {{ kindLabels[change.kind] }}
                </Badge>
              </div>
              <p v-if="change.description" class="change-description">{{ change.description }}</p>

              <div v-if="change.details.length" class="change-details">
                <details
                  v-for="detail in change.details"
                  :key="detail.field"
                  class="change-detail"
                  :open="change.kind === 'balance'"
                >
                  <summary>
                    <strong>{{ detail.field }}</strong>
                    <span v-if="detail.delta" :class="`change-${detail.direction}`">{{ detail.delta }}</span>
                    <span v-else>查看前后差异</span>
                  </summary>
                  <div class="change-values">
                    <div><small>更新前</small><p>{{ detail.before }}</p></div>
                    <i aria-hidden="true">→</i>
                    <div><small>更新后</small><p>{{ detail.after }}</p></div>
                  </div>
                </details>
              </div>
            </div>
          </article>
        </div>
      </article>
    </div>

    <div v-else class="empty-state update-empty-state">
      <strong>没有符合条件的更新</strong>
      <p>尝试清除搜索文字，或切换内容和变化类型。</p>
    </div>

    <p class="update-source-note">自动比较来源：<code>src/data/dove-data.json</code> · 版本标识：游戏 build id 与提交哈希</p>
  </section>
</template>
