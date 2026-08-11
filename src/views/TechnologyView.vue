<script setup lang="ts">
import { computed, ref } from 'vue'
import { familyLabels } from '../data'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import type { Technology, TechnologyTree, TowerFamily } from '../types'

const props = defineProps<{ trees: TechnologyTree[] }>()

const families: TowerFamily[] = ['archer', 'barrack', 'mage', 'engineer']
const familyEnglish: Record<TowerFamily, string> = {
  archer: 'ARCHER',
  barrack: 'BARRACK',
  mage: 'MAGE',
  engineer: 'ARTILLERY',
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

function familyTechnologies(family: TowerFamily) {
  return activeTree.value?.technologies.filter((technology) => technology.family === family) || []
}

function directMetrics(technology: Technology) {
  return [...new Set(technology.modifiers.map((modifier) => metricLabels[modifier.metric]))].join(' · ')
}
</script>

<template>
  <section class="technology-view page-width">
    <div class="page-heading split-heading">
      <div>
        <div class="eyebrow"><span></span> TECHNOLOGY ARCHIVE</div>
        <h1>科技方案<em>全览</em></h1>
        <p>四套科技方案均直接读取游戏脚本。标有“已计入”的项目会同步影响辅助计算台，其余条件型规则保留原始说明。</p>
      </div>
      <div class="technology-ledger">
        <span><strong>{{ trees.length }}</strong><small>套方案</small></span>
        <span><strong>{{ trees.reduce((total, tree) => total + tree.technologies.length, 0) }}</strong><small>项科技</small></span>
        <span><strong>{{ activeTree?.maxLevel || 0 }}</strong><small>阶上限</small></span>
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
      <section v-for="family in families" :key="family" class="technology-family-card">
        <header>
          <div>
            <small>{{ familyEnglish[family] }}</small>
            <h2>{{ familyLabels[family] }}</h2>
          </div>
          <Badge variant="outline">{{ familyTechnologies(family).length }} 项</Badge>
        </header>

        <ol>
          <li v-for="technology in familyTechnologies(family)" :key="`${activeTree?.id}-${technology.id}`">
            <span class="technology-level">{{ String(technology.level).padStart(2, '0') }}</span>
            <div>
              <div class="technology-name-row">
                <strong>{{ technology.name }}</strong>
                <Badge :variant="technology.modifiers.length ? 'secondary' : 'outline'">
                  {{ technology.modifiers.length ? '已计入' : '条件效果' }}
                </Badge>
              </div>
              <p>{{ technology.description }}</p>
              <small v-if="technology.modifiers.length">影响：{{ directMetrics(technology) }}</small>
              <small v-else>保留脚本说明，不统一折算为塔面板数值</small>
            </div>
            <em>{{ technology.price }} ★</em>
          </li>
        </ol>
      </section>
    </div>

    <p class="technology-source">来源：<code>{{ activeTree?.source }}</code></p>
  </section>
</template>
