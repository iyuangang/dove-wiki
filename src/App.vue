<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import type { Tower } from './types'

const activeTab = ref<TabId>(tabFromHash(window.location.hash))
const mobileNavOpen = ref(false)
const selectedTowerId = ref<string | null>(null)
const selectedTower = computed<Tower | null>(() =>
  selectedTowerId.value ? towerById.get(selectedTowerId.value) || null : null,
)
const activeTabMeta = computed(() => tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0])

let routeInitialized = false

watch(activeTab, async (tab) => {
  const targetHash = hashForTab(tab)

  if (window.location.hash !== targetHash) {
    const routeUrl = `${window.location.pathname}${window.location.search}${targetHash}`
    window.history[routeInitialized ? 'pushState' : 'replaceState'](null, '', routeUrl)
  }

  routeInitialized = true
  mobileNavOpen.value = false
  document.title = `${activeTabMeta.value.label} | 王国保卫战鸽子版 WIKI`
  await nextTick()
  window.scrollTo({ top: 0 })
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
</script>

<template>
  <Tabs v-model="activeTab" class="app-shell">
    <header class="site-header">
      <button class="brand" type="button" aria-label="返回塔典" @click="selectTab('catalog')">
        <span class="brand-mark" aria-hidden="true"><span>Ⅱ</span></span>
        <span>
          <strong>王国保卫战鸽子版 WIKI</strong>
          <small>游戏百科 · 数据档案</small>
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
          <small>{{ tab.eyebrow }}</small>
          <span>{{ tab.label }}</span>
        </TabsTrigger>
      </TabsList>

      <Badge variant="outline" class="version-badge">
        <span class="status-dot"></span>
        <span>Game v{{ doveData.metadata.gameVersion }}</span>
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
        :effects="doveData.supportEffects"
        :technology-trees="doveData.technologyTrees"
        @open="openTower"
      />
      <EnemyView
        v-else-if="activeTab === 'enemies'"
        :enemies="enemies"
      />
      <HeroView
        v-else-if="activeTab === 'heroes'"
        :heroes="heroes"
        :effects="doveData.supportEffects"
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
      <DataView
        v-else-if="activeTab === 'data'"
        :data="doveData"
        :site-version="siteVersion"
        @open="openTower"
      />
    </main>

    <footer class="site-footer">
      <span>王国保卫战鸽子版 WIKI</span>
      <span>站点 {{ siteVersion }} · 数据提交 {{ doveData.metadata.commitHash.slice(0, 8) }}</span>
      <span>{{ doveData.summary.encyclopediaImageCount }} 套塔百科图 · {{ doveData.summary.enemyCount }} 个敌人槽位 · {{ doveData.summary.heroCount }} 位英雄 · {{ doveData.summary.technologyTreeCount }} 套科技方案</span>
    </footer>

    <DetailPanel :tower="selectedTower" @close="selectedTowerId = null" />
  </Tabs>
</template>
