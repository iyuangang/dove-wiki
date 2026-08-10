<script setup lang="ts">
import { computed, ref } from 'vue'
import TowerCard from '../components/TowerCard.vue'
import { familyLabels, unlockLabels } from '../data'
import type { DoveData, Tower, TowerFamily, UnlockStatus } from '../types'

const props = defineProps<{
  towers: Tower[]
  summary: DoveData['summary']
}>()
defineEmits<{ open: [tower: Tower] }>()

type SortId = 'encyclopedia' | 'name' | 'damage' | 'range' | 'unlock'

const search = ref('')
const family = ref<'all' | TowerFamily>('all')
const role = ref('all')
const unlock = ref<'all' | UnlockStatus>('all')
const sort = ref<SortId>('encyclopedia')

const roles = computed(() =>
  [...new Set(props.towers.flatMap((tower) => tower.roles))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  ),
)

const filteredTowers = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('zh-CN')
  const result = props.towers.filter((tower) => {
    const haystack = [
      tower.name,
      tower.id,
      tower.description,
      tower.unlock.label,
      ...tower.roles,
      ...tower.families.map((item) => familyLabels[item]),
    ]
      .join(' ')
      .toLocaleLowerCase('zh-CN')

    return (
      (!needle || haystack.includes(needle)) &&
      (family.value === 'all' || tower.families.includes(family.value)) &&
      (role.value === 'all' || tower.roles.includes(role.value)) &&
      (unlock.value === 'all' || tower.unlock.status === unlock.value)
    )
  })

  return result.sort((a, b) => {
    if (sort.value === 'encyclopedia') return a.encyclopediaOrder - b.encyclopediaOrder
    if (sort.value === 'damage') return (b.attack.dps ?? -1) - (a.attack.dps ?? -1)
    if (sort.value === 'range') {
      return (b.attack.range ?? b.attack.rallyRange ?? -1) - (a.attack.range ?? a.attack.rallyRange ?? -1)
    }
    if (sort.value === 'unlock') {
      return (a.unlock.level ?? (a.unlock.status === 'default' ? 0 : 9999)) -
        (b.unlock.level ?? (b.unlock.status === 'default' ? 0 : 9999))
    }
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})

function setQuickRole(value: string) {
  role.value = role.value === value ? 'all' : value
}

function resetFilters() {
  search.value = ''
  family.value = 'all'
  role.value = 'all'
  unlock.value = 'all'
  sort.value = 'encyclopedia'
}
</script>

<template>
  <section class="catalog-view page-width">
    <div class="catalog-hero">
      <div class="hero-copy">
        <div class="eyebrow"><span></span> DOVE FIELD ARCHIVE / CYCLE 2</div>
        <h1>每一座塔，<em>都有据可查。</em></h1>
        <p>
          查询游戏原始伤害、射程、技能与解锁关卡；用多角色标签看清输出、控制与辅助定位。
        </p>
        <div class="quick-role-row">
          <button type="button" :class="{ active: role === '纯输出' }" @click="setQuickRole('纯输出')">纯输出</button>
          <button type="button" :class="{ active: role === '增伤辅助' }" @click="setQuickRole('增伤辅助')">增伤辅助</button>
          <button type="button" :class="{ active: role === '增距辅助' }" @click="setQuickRole('增距辅助')">增距辅助</button>
          <button type="button" :class="{ active: role === '控制' }" @click="setQuickRole('控制')">控制塔</button>
        </div>
      </div>

      <div class="hero-ledger" aria-label="数据概览">
        <div class="ledger-title"><span>ARCHIVE STATUS</span><b>资料库状态</b></div>
        <div class="ledger-grid">
          <div><strong>{{ summary.towerCount }}</strong><small>唯一防御塔</small></div>
          <div><strong>{{ summary.supportTowerCount }}</strong><small>辅助塔</small></div>
          <div><strong>{{ summary.levelUnlockCount }}</strong><small>关卡解锁</small></div>
          <div class="warning"><strong>{{ summary.unlockAnomalyCount }}</strong><small>解锁异常</small></div>
        </div>
        <div class="ledger-foot">
          <span><i></i>{{ summary.encyclopediaImageCount }} 套百科图已还原</span>
          <span>{{ summary.exactDamageCount }}/{{ summary.towerCount }} 基础伤害可精确读取</span>
        </div>
      </div>
    </div>

    <div class="catalog-toolbar">
      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <input v-model="search" type="search" placeholder="搜索名称、模板 ID、描述、标签或关卡…" />
        <kbd>/</kbd>
      </label>
      <div class="filter-grid">
        <label>
          <span>塔族</span>
          <select v-model="family">
            <option value="all">全部塔族</option>
            <option v-for="(label, value) in familyLabels" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <label>
          <span>定位</span>
          <select v-model="role">
            <option value="all">全部定位</option>
            <option v-for="item in roles" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label>
          <span>解锁</span>
          <select v-model="unlock">
            <option v-for="(label, value) in unlockLabels" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select v-model="sort">
            <option value="encyclopedia">游戏百科顺序</option>
            <option value="name">名称</option>
            <option value="damage">理论 DPS</option>
            <option value="range">范围</option>
            <option value="unlock">解锁顺序</option>
          </select>
        </label>
      </div>
    </div>

    <div class="result-line">
      <p>
        找到 <strong>{{ filteredTowers.length }}</strong> 座塔
        <span v-if="sort === 'encyclopedia'"> · 按游戏百科顺序</span>
      </p>
      <button v-if="filteredTowers.length !== towers.length" type="button" @click="resetFilters">清除筛选</button>
    </div>

    <div v-if="filteredTowers.length" class="tower-grid">
      <TowerCard v-for="tower in filteredTowers" :key="tower.id" :tower="tower" @open="$emit('open', $event)" />
    </div>
    <div v-else class="empty-state">
      <span>⌕</span>
      <h2>没有匹配的防御塔</h2>
      <p>尝试缩短关键词，或清除一个分类条件。</p>
      <button type="button" @click="resetFilters">重置全部筛选</button>
    </div>
  </section>
</template>
