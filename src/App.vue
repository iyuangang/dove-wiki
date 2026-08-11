<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import DetailPanel from './components/DetailPanel.vue'
import { Badge } from './components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { doveData, siteVersion, towerById, towers } from './data'
import CalculatorView from './views/CalculatorView.vue'
import CatalogView from './views/CatalogView.vue'
import CompareView from './views/CompareView.vue'
import DataView from './views/DataView.vue'
import type { Tower } from './types'

type TabId = 'catalog' | 'calculator' | 'compare' | 'data'

const tabs: Array<{ id: TabId; label: string; eyebrow: string }> = [
  { id: 'catalog', label: '塔典', eyebrow: 'CATALOG' },
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
          <strong>DOVE TOWER WIKI</strong>
          <small>王国保卫战 · 防御塔档案</small>
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
        :effects="doveData.supportEffects"
        :technology-trees="doveData.technologyTrees"
        @open="openTower"
      />
      <CompareView
        v-else-if="activeTab === 'compare'"
        :towers="towers"
        @open="openTower"
      />
      <DataView
        v-else
        :data="doveData"
        :site-version="siteVersion"
        @open="openTower"
      />
    </main>

    <footer class="site-footer">
      <span>Dove 数据驱动塔典</span>
      <span>站点 {{ siteVersion }} · 数据提交 {{ doveData.metadata.commitHash.slice(0, 8) }}</span>
      <span>{{ doveData.summary.encyclopediaImageCount }} 套百科图 · {{ doveData.summary.portraitFallbackCount }} 张基础塔头像回退 · {{ doveData.summary.technologyTreeCount }} 套科技方案</span>
    </footer>

    <DetailPanel :tower="selectedTower" @close="selectedTowerId = null" />
  </Tabs>
</template>
