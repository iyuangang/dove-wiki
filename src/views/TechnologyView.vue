<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import type { Technology, TechnologyFamily, TechnologyTree } from '../types'

const props = defineProps<{ trees: TechnologyTree[] }>()

const families: TechnologyFamily[] = [
  'archer',
  'barrack',
  'mage',
  'engineer',
  'rain',
  'reinforcement',
]
const familyEnglish: Record<TechnologyFamily, string> = {
  archer: 'ARCHERS',
  barrack: 'BARRACKS',
  mage: 'MAGES',
  engineer: 'ARTILLERY',
  rain: 'RAIN / THUNDER',
  reinforcement: 'REINFORCEMENTS',
}
const familyNames: Record<Exclude<TechnologyFamily, 'rain'>, string> = {
  archer: '弓箭塔',
  barrack: '兵营塔',
  mage: '法师塔',
  engineer: '工程塔',
  reinforcement: '援军',
}
const metricLabels: Record<string, string> = {
  damage: '伤害',
  expectedDps: '期望 DPS',
  range: '范围',
  cooldown: '攻击间隔',
  price: '价格',
  rallyRange: '集结范围',
  soldierHp: '士兵生命',
  soldierArmor: '士兵护甲',
  soldierMagicArmor: '士兵魔抗',
  respawn: '重生时间',
  soldierCount: '士兵数量',
}

const activeTreeId = ref(String(props.trees[0]?.id || 1))
const activeTree = computed(
  () => props.trees.find((tree) => String(tree.id) === activeTreeId.value) || props.trees[0],
)

function familyTechnologies(family: TechnologyFamily) {
  return activeTree.value?.technologies.filter((technology) => technology.family === family) || []
}

function familyName(family: TechnologyFamily) {
  if (family !== 'rain') return familyNames[family]
  return familyTechnologies(family).some((technology) => technology.id.startsWith('thunder_'))
    ? '雷电术'
    : '火焰雨'
}

function directMetrics(technology: Technology) {
  return [...new Set(technology.modifiers.map((modifier) => metricLabels[modifier.metric]))].join(' · ')
}

function isTowerTechnology(technology: Technology) {
  return ['archer', 'barrack', 'mage', 'engineer'].includes(technology.family)
}

function statusLabel(technology: Technology) {
  if (!isTowerTechnology(technology)) return '独立能力'
  return technology.modifiers.length ? '已计入塔面板' : '条件效果'
}
</script>

<template>
  <section class="technology-view technology-page-width page-width">
    <div class="page-heading split-heading">
      <div>
        <div class="eyebrow"><span></span> TECHNOLOGY ARCHIVE</div>
        <h1>科技方案<em>全览</em></h1>
        <p>完整读取游戏科技页的六条路线：四类防御塔、范围技能与援军。桌面端按游戏顺序六列并排展示，每套方案均包含 36 项科技。</p>
      </div>
      <div class="technology-ledger">
        <span><strong>{{ trees.length }}</strong><small>套方案</small></span>
        <span><strong>{{ trees.reduce((total, tree) => total + tree.technologies.length, 0) }}</strong><small>项完整科技</small></span>
        <span><strong>{{ families.length }}</strong><small>条科技路线</small></span>
      </div>
    </div>

    <Tabs v-model="activeTreeId" class="technology-tabs">
      <TabsList variant="line" class="technology-tab-list" aria-label="科技方案">
        <TabsTrigger v-for="tree in trees" :key="tree.id" :value="String(tree.id)">
          <small>SCHEME {{ tree.id }}</small>
          <span>{{ tree.name }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="technology-family-grid">
      <section
        v-for="(family, familyIndex) in families"
        :key="family"
        class="technology-family-card"
        :class="`technology-family-${family}`"
      >
        <header>
          <span class="technology-family-index">{{ String(familyIndex + 1).padStart(2, '0') }}</span>
          <div>
            <small>{{ familyEnglish[family] }}</small>
            <h2>{{ familyName(family) }}</h2>
          </div>
          <Badge variant="outline">{{ familyTechnologies(family).length }} 阶</Badge>
        </header>

        <ol>
          <li v-for="technology in familyTechnologies(family)" :key="`${activeTree?.id}-${technology.id}`">
            <div class="technology-icon-frame">
              <img :src="technology.icon" :alt="`${technology.name}科技图标`" loading="lazy" />
              <span>Lv.{{ technology.level }}</span>
            </div>
            <div class="technology-copy">
              <div class="technology-name-row">
                <strong>{{ technology.name }}</strong>
                <em>{{ technology.price }} ★</em>
              </div>
              <p>{{ technology.description }}</p>
              <div class="technology-meta">
                <Badge :variant="technology.modifiers.length ? 'secondary' : 'outline'">
                  {{ statusLabel(technology) }}
                </Badge>
                <small v-if="technology.modifiers.length">{{ directMetrics(technology) }}</small>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <p class="technology-source">来源：<code>{{ activeTree?.source }}</code> · 顺序：<code>upgrades.display_order</code></p>
  </section>
</template>
