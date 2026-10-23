<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { experimentMetrics, parseExperiment, type ExperimentResult } from '../lib/experiments'
const data=ref<ExperimentResult|null>(null),failure=ref(''),suite=ref('all'),metric=ref('dps')
let revision=0
watch(suite,value=>{metric.value=({mobility:'first_arrival',support:'ally_dps_gain',survival:'alive_percent',budget:'dps'} as Record<string,string>)[value]||'dps'})
async function readFile(event:Event){
  const id=++revision;failure.value='';data.value=null
  const file=(event.target as HTMLInputElement).files?.[0];if(!file)return
  try{if(file.size>50*1024*1024)throw new Error('实验文件不能超过50 MB');const result=parseExperiment(await file.text());if(id===revision)data.value=result}catch(e){if(id===revision)failure.value=e instanceof Error?e.message:String(e)}
}
const rows=computed(()=>data.value?.subjects.flatMap(o=>o.conditions.filter(c=>suite.value==='all'||c.suite===suite.value).map(c=>({object:o,condition:c})))||[])
const maximum=computed(()=>Math.max(1,...rows.value.map(r=>r.condition.metrics[metric.value]?.mean||0)))
const number=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:3})
</script>
<template>
  <section class="experiment-viewer" aria-labelledby="experiments-title">
    <h2 id="experiments-title">独立实验室</h2>
    <p>实验用于补充场景与讨论遗漏，不生成 S/A 等级，不更新正式基准，也不改变上方天梯。文件仅在本机浏览器中读取，不会自动上传。</p>
    <p>在插件目录运行 <code>Run-Experiments.cmd</code>，选择生成的 <code>experiments.json</code>。可分别运行机动、辅助、生存压力或同预算多塔实验；完整参数见插件使用说明。</p>
    <label class="file">读取本地实验结果<input type="file" accept=".json,application/json" aria-label="读取本地实验结果" @change="readFile" /></label>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <template v-if="data">
      <p>Dove {{ data.environment.game_version }} · 提交 {{ data.environment.commit.slice(0,12) }} · {{ data.conditions.seconds }} 秒 × {{ data.conditions.repeats }} 种子 · {{ data.protocol }}</p>
      <details><summary>条件与局限（请先阅读）</summary><p v-for="note in data.notes" :key="note">{{ note }}</p></details>
      <div class="controls"><label>实验类型<select v-model="suite" aria-label="实验类型"><option value="all">全部</option><option value="mobility">机动</option><option value="support">辅助</option><option value="survival">生存压力</option><option value="budget">同预算多塔</option></select></label><label>原始指标<select v-model="metric" aria-label="实验原始指标"><option v-for="(label,key) in experimentMetrics" :key="key" :value="key">{{ label }}</option></select></label></div>
      <p>条形仅展示所选原始指标；首段耗时越低越快，伤害与存活等指标须结合具体实验条件理解。范围是固定种子的观测范围，不是置信区间。</p>
      <article v-for="row in rows" :key="row.object.id+'/'+row.condition.id">
        <h3>{{ row.object.name }} · {{ row.condition.name }}</h3><small>{{ row.condition.attempted-row.condition.failed }} / {{ row.condition.attempted }} 成功 · {{ row.condition.state==='complete'?'完成':'证据不完整' }}</small>
        <template v-if="row.condition.metrics[metric]"><p>{{ experimentMetrics[metric] }}：{{ number(row.condition.metrics[metric]!.mean) }} [{{ number(row.condition.metrics[metric]!.min) }}–{{ number(row.condition.metrics[metric]!.max) }}] · n={{ row.condition.metrics[metric]!.n }}</p><div class="bar" :style="{width:Math.max(0,row.condition.metrics[metric]!.mean)/maximum*100+'%'}"></div></template><p v-else>本条件没有此项有效样本；首段未完成时不填零耗时。</p>
        <details><summary>查看原始逐轮证据</summary><pre>{{ JSON.stringify(row.object.rounds[row.condition.id],null,2) }}</pre></details>
      </article>
      <details v-if="data.errors.length"><summary>实验运行错误</summary><pre>{{ data.errors.join('\n') }}</pre></details>
    </template>
  </section>
</template>
<style scoped>
.experiment-viewer{margin-top:24px;border:1px solid var(--line);padding:20px;border-radius:10px;min-width:0}.experiment-viewer h2{font-size:21px;margin-bottom:16px}.experiment-viewer p{font-size:13px;line-height:1.8;color:var(--muted)}.file,.controls label{display:grid;gap:8px;font-size:13px;max-width:100%}.controls{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px}.controls select{background:var(--panel);color:var(--ink);padding:10px;border:1px solid var(--line-bright);max-width:100%}.controls label{min-width:0}input{max-width:100%}article{padding:16px 0;border-bottom:1px solid var(--line)}h3{font-size:16px}.bar{height:8px;background:var(--gold);max-width:100%;margin-block:8px}pre{max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}code{overflow-wrap:anywhere}small{color:var(--muted)}summary{cursor:pointer;padding-block:10px}
</style>
