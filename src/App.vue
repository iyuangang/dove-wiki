<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import DetailPanel from './components/DetailPanel.vue'
import { Badge } from './components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { doveData, enemies, gameChangelog, heroes, siteVersion, towerById, towers } from './data'
import CalculatorView from './views/CalculatorView.vue'
import CatalogView from './views/CatalogView.vue'
import CompareView from './views/CompareView.vue'
import DataView from './views/DataView.vue'
import EnemyView from './views/EnemyView.vue'
import HeroView from './views/HeroView.vue'
import TechnologyView from './views/TechnologyView.vue'
import UpdateHistoryView from './views/UpdateHistoryView.vue'
import type { Tower } from './types'

type TabId = 'catalog' | 'enemies' | 'heroes' | 'technology' | 'updates' | 'calculator' | 'compare' | 'data'

const tabs: Array<{ id: TabId; label: string; eyebrow: string }> = [
  { id: 'catalog', label: '塔典', eyebrow: 'CATALOG' },
  { id: 'enemies', label: '敌人', eyebrow: 'ENEMIES' },
  { id: 'heroes', label: '英雄', eyebrow: 'HEROES' },
  { id: 'technology', label: '科技', eyebrow: 'TECH' },
  { id: 'updates', label: '更新', eyebrow: 'UPDATES' },
  { id: 'calculator', label: '辅助计算', eyebrow: 'BUFF LAB' },
  { id: 'compare', label: '双塔对比', eyebrow: 'COMPARE' },
  { id: 'data', label: '数据说明', eyebrow: 'SOURCES' },
]

const activeTab = ref<TabId>('catalog')
const selectedTowerId = ref<string | null>(null)
const selectedTower = computed<Tower | null>(() =>
  selectedTowerId.value ? towerById.get(selectedTowerId.value) || null : null,
)

watch(activeTab, async () => {
  await nextTick()
  window.scrollTo({ top: 0 })
})

function openTower(tower: Tower) {
  selectedTowerId.value = tower.id
}
</script>

<template>
  <Tabs v-model="activeTab" class="app-shell">
    <header class="site-header">
      <button class="brand" type="button" aria-label="返回塔典" @click="activeTab = 'catalog'">
        <span class="brand-mark" aria-hidden="true"><span>Ⅱ</span></span>
        <span>
          <strong>王国保卫战鸽子版 WIKI</strong>
          <small>游戏百科 · 数据档案</small>
        </span>
      </button>

      <TabsList class="main-nav" variant="line" aria-label="主导航">
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.id"
          :value="tab.id"
          :class="{ active: activeTab === tab.id }"
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
