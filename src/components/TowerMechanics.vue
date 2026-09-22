<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Tower } from '../types'
import { formatNumber } from '../lib/calculator'
import { shaolinVolley } from '../lib/shaolin'

const props = defineProps<{ tower: Tower }>()
const level = ref(0)
const targets = ref(1)
const isShaolin = computed(() => props.tower.mechanics.items.some((item) => item.id === 'shaolin-distribution'))
const volley = computed(() => shaolinVolley(3 + level.value, targets.value, props.tower.attack.damageMin ?? 0, props.tower.attack.damageMax ?? 0))
const labels = { intrinsic: '固有机制', 'skill-interaction': '技能联动', 'damage-rule': '伤害规则' }
</script>

<template>
  <section class="detail-section mechanics-section">
    <div class="section-title"><span>实战机制 · 脚本核实</span><small>{{ tower.mechanics.items.length }} 条已核实</small></div>
    <p class="mechanic-intro">说明之外的触发条件、伤害变化和结算规则。依据游戏 {{ tower.mechanics.reviewedVersion }} 源码；除另有说明，均未计科技与外部增益。动画时长为推算，未做逐帧实机测量。</p>
    <p v-if="tower.mechanics.pending.length" class="mechanic-review-note">游戏源码已变化，以下条目待复核，暂不展示旧结论：{{ tower.mechanics.pending.join('、') }}。</p>
    <p v-if="!tower.mechanics.hasSpecificReview" class="mechanic-review-note">本塔专属攻击脚本尚未逐项核实；下列通用伤害规则不代表本塔没有其他特性。</p>
    <div class="mechanic-list">
      <article v-for="item in tower.mechanics.items" :key="item.id" class="mechanic-card">
        <div class="mechanic-heading"><h3>{{ item.title }}</h3><span>{{ labels[item.kind] }}</span></div>
        <p>{{ item.summary }}</p>
        <ul><li v-for="detail in item.details" :key="detail">{{ detail }}</li></ul>
        <p v-if="item.formula" class="mechanic-formula">{{ item.formula }}</p>
        <details class="unit-source"><summary>查看源码依据</summary><div v-for="source in item.sources" :key="`${source.file}-${source.symbol}`"><span>{{ source.file }}<template v-if="source.line">:{{ source.line }}</template></span><code>{{ source.symbol }}</code></div></details>
      </article>
    </div>
    <div v-if="isShaolin" class="shaolin-calculator">
      <h3>少林寺 · 一轮攻击分配</h3>
      <div class="mechanic-controls">
        <label>人多势众<select v-model="level" aria-label="人多势众计算等级"><option v-for="l in [0, 1, 2, 3]" :key="l" :value="l">{{ l ? `${l} 级` : '未购买' }} · {{ 3 + l }} 名僧众</option></select></label>
        <label>可选目标<select v-model="targets" aria-label="少林寺可选目标数"><option v-for="n in 6" :key="n" :value="n">{{ n }} 个{{ n === 6 ? '（或更多）' : '' }}</option></select></label>
      </div>
      <div class="mechanic-table-wrap"><table class="mechanic-table"><thead><tr><th>僧众</th><th>目标</th><th>伤害倍率</th><th>伤害</th></tr></thead><tbody><tr v-for="hit in volley.hits" :key="hit.monk"><td>{{ hit.monk }}</td><td>{{ hit.target }}</td><td>{{ formatNumber(hit.factor * 100) }}%</td><td>{{ formatNumber(hit.min) }}–{{ formatNumber(hit.max) }}</td></tr></tbody></table></div>
      <p class="mechanic-total">整轮合计 <strong>{{ formatNumber(volley.min) }}–{{ formatNumber(volley.max) }}</strong></p>
      <p class="unit-footnote">按当前基础伤害、出手时目标列表计算；未计护甲、科技、随机取值取整、目标提前死亡或神龙大侠。目标 6 个以上时分配结果相同。此计算不改动辅助计算器的 DPS。</p>
    </div>
    <p v-if="tower.mechanics.hasSpecificReview" class="unit-footnote">已核实条目并非穷尽清单。源码指纹变化后会暂停展示相关结论，等待重新核对。</p>
  </section>
</template>
