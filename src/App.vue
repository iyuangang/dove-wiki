<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { Castle, Skull, Swords, Sparkles, History, FlaskConical, Columns2, BookOpen, Trophy } from '@lucide/vue'
import DetailPanel from './components/DetailPanel.vue'
import { Badge } from './components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { doveData, enemies, gameChangelog, heroes, siteVersion, towerById, towers } from './data'
import { hashForTab, navigationTabs as tabs, tabFromHash, type TabId } from './lib/navigation'
import CalculatorView from './views/CalculatorView.vue'
import CatalogView from './views/CatalogView.vue'
import CompareView from './views/CompareView.vue'
import DataView from './views/DataView.vue'
import EnemyView from './views/EnemyView.vue'
import HeroView from './views/HeroView.vue'
import TechnologyView from './views/TechnologyView.vue'
import UpdateHistoryView from './views/UpdateHistoryView.vue'
import ratingManifest from './data/rating-manifest.json'
const RatingView = defineAsyncComponent(() => import('./views/RatingView.vue'))
import type { Enemy, Tower } from './types'
import { createWorkspace, loadEnemyPanel, workspaceKey } from './composables/useWorkspace'

const workspace = createWorkspace(doveData.supportEffects, doveData.technologyTrees)
provide(workspaceKey, workspace)
const activeTab = ref<TabId>(tabFromHash(window.location.hash))
const navIcons = { catalog: Castle, enemies: Skull, heroes: Swords, tierlist: Trophy, technology: Sparkles, updates: History, calculator: FlaskConical, compare: Columns2, data: BookOpen }
const activeSnapshot = computed(() => activeTab.value === 'tierlist' ? ratingManifest : activeTab.value === 'heroes' ? doveData.metadata.heroSnapshot || doveData.metadata : doveData.metadata)
const mobileNavOpen = ref(false)
const selectedTowerId = ref<string | null>(null)
const selectedTower = computed<Tower | null>(() =>
  selectedTowerId.value ? towerById.get(selectedTowerId.value) || null : null,
)
const activeTabMeta = computed(() => tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0])

let routeInitialized = false

watch(activeTab, async (tab, previousTab) => {
  if (previousTab) workspace.scroll[previousTab] = window.scrollY
  selectedTowerId.value = null
  const targetHash = hashForTab(tab)

  if (window.location.hash !== targetHash) {
    const routeUrl = `${window.location.pathname}${window.location.search}${targetHash}`
    window.history[routeInitialized ? 'pushState' : 'replaceState'](null, '', routeUrl)
  }

  routeInitialized = true
  mobileNavOpen.value = false
  document.title = `${activeTabMeta.value.label} | 王国保卫战鸽子版 WIKI`
  await nextTick()
  window.scrollTo({ top: workspace.scroll[tab] || 0, behavior: 'instant' })
}, { immediate: true })

function syncTabFromAddress() {
  const tab = tabFromHash(window.location.hash)
  const canonicalHash = hashForTab(tab)

  if (window.location.hash !== canonicalHash) {
    const routeUrl = `${window.location.pathname}${window.location.search}${canonicalHash}`
    window.history.replaceState(null, '', routeUrl)
  }

  activeTab.value = tab
  mobileNavOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') mobileNavOpen.value = false
}

function selectTab(tab: TabId) {
  activeTab.value = tab
  mobileNavOpen.value = false
}

onMounted(() => {
  window.addEventListener('popstate', syncTabFromAddress)
  window.addEventListener('hashchange', syncTabFromAddress)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncTabFromAddress)
  window.removeEventListener('hashchange', syncTabFromAddress)
  window.removeEventListener('keydown', handleKeydown)
})

function openTower(tower: Tower) {
  selectedTowerId.value = tower.id
}
async function enterTool(tab: TabId, focusId: string) {
  workspace.scroll[tab] = 0
  selectedTowerId.value = null
  selectTab(tab)
  await nextTick()
  document.getElementById(focusId)?.focus({ preventScroll: true })
  document.getElementById(focusId)?.scrollIntoView({ block: 'start', behavior: 'instant' })
}
function calculateTower(tower: Tower) {
  workspace.calculator.targetId = tower.id
  workspace.calculator.notice = '已选用 ' + tower.name + '；保留现有科技、辅助与傀儡参数。'
  enterTool('calculator', 'calculator-target')
}
function enableSupport(effectIds: string[]) {
  for (const id of effectIds) {
    if (workspace.calculator.effects[id]) workspace.calculator.effects[id].enabled = true
  }
  workspace.calculator.supportSourceFilter = 'selected'
  workspace.calculator.supportSearch = ''
  workspace.calculator.notice = '已启用所选来源的辅助；请查看各效果是否适用于当前目标塔。'
  enterTool('calculator', 'calculator-supports')
}
function calculateEnemy(enemy: Enemy, difficulty: number) {
  if (!loadEnemyPanel(workspace.calculator, enemy, difficulty)) return
  workspace.calculator.notice = '已载入 ' + enemy.name + ' 的敌人面板；保留当前攻击和辅助配置。'
  enterTool('calculator', 'calculator-dummy')
}
function compareTower(tower: Tower, side: 'left' | 'right') {
  workspace.compare[side === 'left' ? 'leftId' : 'rightId'] = tower.id
  enterTool('compare', 'compare-' + side)
}
</script>

<template>
  <Tabs v-model="activeTab" class="app-shell">
    <header class="site-header">
      <button class="brand" type="button" aria-label="返回塔典" @click="selectTab('catalog')">
        <span class="brand-mark" aria-hidden="true"><Castle :size="24" :stroke-width="1.5" /></span>
        <span>
          <strong>王国保卫战<span class="brand-edition">鸽子版</span></strong>
          <small>DOVE WIKI · 游戏数据图鉴</small>
        </span>
      </button>

      <button
        class="mobile-nav-toggle"
        type="button"
        :aria-label="mobileNavOpen ? '收起导航' : '展开导航'"
        :aria-expanded="mobileNavOpen"
        aria-controls="main-navigation"
        @click="mobileNavOpen = !mobileNavOpen"
      >
        <span class="mobile-nav-toggle-icon" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        <span>
          <small>当前页面</small>
          <strong>{{ activeTabMeta.label }}</strong>
        </span>
      </button>

      <button
        v-if="mobileNavOpen"
        class="mobile-nav-backdrop"
        type="button"
        aria-label="关闭导航"
        @click="mobileNavOpen = false"
      ></button>

      <TabsList
        id="main-navigation"
        class="main-nav"
        :class="{ 'mobile-open': mobileNavOpen }"
        variant="line"
        aria-label="主导航"
      >
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.id"
          :value="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="mobileNavOpen = false"
        >
          <component :is="navIcons[tab.id]" :size="16" :stroke-width="1.7" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </TabsTrigger>
      </TabsList>

      <Badge variant="outline" class="version-badge">
        <span class="status-dot"></span>
        <span>Game v{{ activeSnapshot.gameVersion }}</span>
        <strong>Site {{ siteVersion }}</strong>
      </Badge>
    </header>

    <main>
      <CatalogView
        v-if="activeTab === 'catalog'"
        :towers="towers"
        :summary="doveData.summary"
        @open="openTower"
      />
      <CalculatorView
        v-else-if="activeTab === 'calculator'"
        :towers="towers"
        :heroes="heroes"
        :enemies="enemies"
        :effects="doveData.supportEffects"
        :technology-trees="doveData.technologyTrees"
        @open="openTower"
      />
      <EnemyView
        v-else-if="activeTab === 'enemies'"
        :enemies="enemies"
        @calculate="calculateEnemy"
      />
      <HeroView
        v-else-if="activeTab === 'heroes'"
        :heroes="heroes"
        :effects="doveData.supportEffects"
        :data-version="activeSnapshot.gameVersion"
        @support="enableSupport"
      />
      <TechnologyView
        v-else-if="activeTab === 'technology'"
        :trees="doveData.technologyTrees"
      />
      <UpdateHistoryView
        v-else-if="activeTab === 'updates'"
        :history="gameChangelog"
      />
      <CompareView
        v-else-if="activeTab === 'compare'"
        :towers="towers"
        @open="openTower"
      />
      <RatingView v-else-if="activeTab === 'tierlist'" />
      <DataView
        v-else-if="activeTab === 'data'"
        :data="doveData"
        :site-version="siteVersion"
        @open="openTower"
      />
    </main>

    <footer class="site-footer">
      <span>王国保卫战鸽子版 WIKI</span>
      <span>站点 {{ siteVersion }} · 数据提交 {{ activeSnapshot.commitHash.slice(0, 8) }}</span>
      <span>{{ doveData.summary.encyclopediaImageCount }} 套塔百科图 · {{ doveData.summary.enemyCount }} 个敌人槽位 · {{ doveData.summary.heroCount }} 位英雄 · {{ doveData.summary.technologyTreeCount }} 套科技方案</span>
    </footer>

    <DetailPanel :tower="selectedTower" :effects="doveData.supportEffects" @close="selectedTowerId = null" @calculate="calculateTower" @support="enableSupport" @compare="compareTower" />
  </Tabs>
</template>
