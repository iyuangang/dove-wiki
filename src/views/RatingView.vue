<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { Download, ExternalLink, RefreshCw, Trophy } from '@lucide/vue'
import siteIndex from '../data/site-index.json'
import { publicAssetUrl } from '../lib/public-assets'
import { readRatingRoute, writeRatingRoute } from '../lib/rating-route'
import { cohortComparison, feedbackBundle } from '../lib/rating-insights'
const ExperimentViewer=defineAsyncComponent(()=>import('../components/ExperimentViewer.vue'))
const showExperiments=ref(false)
const initial = readRatingRoute(window.location.hash)
import manifest from '../data/rating-manifest.json'
import methodology from '../data/rating-methodology.json'
import metricGuide from '../data/rating-contract.json'
import { axesFor, filterRatings, radarPoint, radarPolygon, ratingAxes, ratingGroups, ratingNumber, ratingRoles, ratingTier, ratingTiers, type RatingDataset, type RatingObject, type RatingProfile, type RatingRole } from '../lib/ratings'
import { loadRatingDataset, ratingAssetUrl } from '../lib/rating-loader'

const emit = defineEmits<{ profileChange: [profile: RatingProfile] }>()
const profile = ref<RatingProfile>(initial.profile)
watch(profile, value => emit('profileChange', value), { immediate: true })
const role = ref<RatingRole>(initial.role)
const group = ref(initial.group)
const search = ref(initial.q)
const selectedId = ref(initial.id)
const dataset = ref<RatingDataset | null>(null)
const loading = ref(false)
const failure = ref('')
const retry = ref(0)
const methodsSection = ref<HTMLElement | null>(null)
const detailSection = ref<HTMLElement | null>(null)
function scrollTo(section: HTMLElement | null) {
  section?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}
watch([profile, retry], async ([current], _, cleanup) => {
  const abort = new AbortController()
  cleanup(() => abort.abort())
  loading.value = true; dataset.value = null; failure.value = ''
  try {
    const result = await loadRatingDataset(manifest.profiles[current], current, abort.signal)
    if (!abort.signal.aborted) dataset.value = result
  } catch (error) {
    if (!abort.signal.aborted) failure.value = error instanceof Error ? error.message : '无法读取测评结果'
  } finally { if (!abort.signal.aborted) loading.value = false }
}, { immediate: true })
const summary = computed(() => manifest.profiles[profile.value])
const rows = computed(() => filterRatings(dataset.value?.objects || [], group.value, role.value, search.value))
const selected = computed(() => rows.value.find(r => r.id === selectedId.value) || rows.value[0])
const axes = computed(() => axesFor(selected.value?.kind || (group.value.startsWith('hero') ? 'hero' : 'tower')))
const rankedCount = computed(() => rows.value.filter(r => ratingTier(r, role.value) !== '未评测').length)
const tiers = computed(() => ratingTiers.map(grade => ({ grade, rows: rows.value.filter(r => ratingTier(r, role.value) === grade) })).filter(t => t.rows.length))
const currentGroup = computed(() => ratingGroups.find(g => g[0] === group.value)?.[1])
const gradeCaption = metricGuide.tiers.map(t => `${t.grade} ${t.exclusive ? '>' : '≥'} ${t.min}`).join(' · ') + ' · 无 = 0'
function roleWeights(id: RatingRole) {
  return Object.entries(metricGuide.weights.hero[id]).map(([key, weight]) => {
    const label = key === 'survival' ? '生存（英雄）／拦截（塔）' : metricGuide.axes[key as keyof typeof metricGuide.axes].label
    return `${label} ${Math.round(weight * 100)}%`
  }).join(' · ')
}
const image = (row: RatingObject) => publicAssetUrl((siteIndex.portraits as Record<string,string>)[row.templateId] || '')
const polygon = computed(() => selected.value ? radarPolygon(selected.value) : null)
const ring = (value: number) => axes.value.map((_, i) => radarPoint(i, value).join(',')).join(' ')
const point = (i: number, value: number) => radarPoint(i, value)
const labelPoint = (i: number) => radarPoint(i, 100, 173)
const file = (name: string) => ratingAssetUrl(`rating/${profile.value}/${name}`, summary.value.sha256)
const evidenceUrl = computed(() => selected.value ? ratingAssetUrl(selected.value.evidence.file, selected.value.evidence.gzipSha256) : '')
const comparison = computed(() => dataset.value && selected.value ? cohortComparison(dataset.value,selected.value) : [])
const shareStatus = ref('')
function syncRoute() { const r=readRatingRoute(window.location.hash);profile.value=r.profile;group.value=r.group;role.value=r.role;selectedId.value=r.id;search.value=r.q }
window.addEventListener('hashchange',syncRoute);window.addEventListener('popstate',syncRoute)
onBeforeUnmount(()=>{window.removeEventListener('hashchange',syncRoute);window.removeEventListener('popstate',syncRoute)})
watch([profile,group,role,selectedId,search],()=>{
  if(!window.location.hash.startsWith('#/tierlist'))return
  const hash=writeRatingRoute({profile:profile.value,group:group.value,role:role.value,id:selectedId.value,q:search.value})
  window.history.replaceState(null,'',window.location.pathname+window.location.search+hash)
})
async function copyLink() {
  const hash=writeRatingRoute({profile:profile.value,group:group.value,role:role.value,id:selected.value?.id||'',q:search.value})
  window.history.replaceState(null,'',window.location.pathname+window.location.search+hash)
  try { await navigator.clipboard.writeText(window.location.href);shareStatus.value='链接已复制' } catch { shareStatus.value='请复制浏览器地址栏中的链接' }
}
function downloadFeedback() {
  if(!dataset.value||!selected.value)return
  const url=URL.createObjectURL(new Blob([JSON.stringify(feedbackBundle(dataset.value,selected.value,window.location.href),null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=selected.value.id+'-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
const feedbackUrl = computed(() => {
  const row = selected.value
  const body = `游戏版本 / 提交：${summary.value.gameVersion} / ${summary.value.commitHash}\n批次：${summary.value.runId}\n对象：${row?.name || ''} / ${row?.id || ''}\n档位：${profile.value}\n场景ID / 种子：\n预期机制与依据：\n实际现象与原始证据：\n复现步骤或视频：\n建议修正：采集错误 / 场景遗漏 / 指标定义 / 权重偏好\n验收方法：`
  return 'https://github.com/iyuangang/dove-wiki/issues/new?' + new URLSearchParams({ title: `[强度天梯] ${row?.name || '机制反馈'}`, body })
})
</script>

<template>
  <section class="rating-page page-width" aria-label="强度天梯测评结果">
    <header class="rating-heading">
      <div><div class="eyebrow"><span></span> COMBAT LAB · NATIVE BENCHMARK</div><h1>强度<em>天梯</em></h1>
        <p>英雄分别评测近战与远程，常规防御塔按阶级独立比较。选择用途，查看八维能力与实测证据。</p></div>
      <div class="rating-stamp"><Trophy :size="26" aria-hidden="true" /><strong>Dove {{ summary.gameVersion }}</strong><span>{{ summary.asOf }} 实测 · {{ profile === 'standard' ? '标准' : '快速' }}档</span></div>
    </header>
    <div class="rating-facts" aria-label="本档测评覆盖">
      <div><strong>{{ summary.coreTrials.toLocaleString() }}</strong><span>正式轮次 · 全部成功</span></div>
      <div><strong>{{ summary.seconds }} 秒 × {{ summary.repeats }}</strong><span>每场景时长与固定种子数</span></div>
      <div><strong>{{ dataset ? `${dataset.objects.filter(r => r.core && r.kind === 'hero').length} + ${dataset.objects.filter(r => r.core && r.kind === 'tower').length}` : '—' }}</strong><span>英雄模式条目与常规塔</span></div>
      <div><strong>{{ summary.failedTrials }}</strong><span>附录失败轮次 · 不评级</span></div>
    </div>
    <p class="rating-notice">固定靶场的原生自动能力基准，保留自动技能、反击与召唤物。手动大招和实战操作尚未完整覆盖；快速档与标准档分别校准，不直接混排。本站其他百科页面仍使用各自标注的数据版本。</p>
    <p v-if="summary.commitHash !== siteIndex.metadata.commitHash" class="rating-notice" role="note">历史实测：本页测于 Dove {{ summary.gameVersion }}（提交 {{ summary.commitHash.slice(0, 12) }}），当前百科已同步至 {{ siteIndex.metadata.gameVersion }}（提交 {{ siteIndex.metadata.commitHash.slice(0, 12) }}）。新增对象与机制改动尚未重新测评，不能将旧天梯直接视为新版排名。</p>
    <p class="rating-caption">参照来源：本档完整原版实测的正值中位数 · {{ summary.coreTrials.toLocaleString() }} 轮正式样本完整 · 评分定义 {{ metricGuide.contractVersion }} / 评分版本 {{ metricGuide.scoreVersion }}。快速、标准及个人基准各自独立。</p>

    <div class="rating-controls">
      <label>测评档位<select v-model="profile" aria-label="测评档位"><option value="standard">标准 · 60 秒 × 5 种子</option><option value="quick">快速 · 30 秒 × 3 种子</option></select></label>
      <label>对象类别<select v-model="group" aria-label="对象类别"><option v-for="[id, label] in ratingGroups" :key="id" :value="id">{{ label }}</option></select></label>
      <label>评价方向<select v-model="role" aria-label="评价方向"><option v-for="(label, id) in ratingRoles" :key="id" :value="id">{{ label }}</option></select></label>
      <label class="rating-search">搜索对象<input v-model="search" aria-label="搜索对象" type="search" placeholder="名称 / 模板 ID" /></label>
    </div>
    <div class="rating-links"><button type="button" @click="copyLink">复制当前筛选与对象链接</button><span role="status">{{ shareStatus }}</span><a :href="file(`${group}_${role}.png`)" download><Download :size="15" />此分类完整天梯图</a><a :href="file('native_scores.csv')" download>本档完整 CSV</a><a :href="file('results.json')" download>指标与来源 JSON</a><button type="button" @click="scrollTo(methodsSection)">测评标准与局限</button></div>

    <details class="rating-guide">
      <summary>{{ metricGuide.title }} · {{ group.startsWith('hero') ? '英雄' : '防御塔' }}</summary>
      <p>{{ metricGuide.intro }}</p>
      <dl class="rating-guide-list">
        <div v-for="key in axes" :key="key">
          <dt>{{ metricGuide.axes[key].label }}<span>{{ metricGuide.axes[key].question }}</span></dt>
          <dd>{{ metricGuide.axes[key].plain }}</dd>
        </div>
      </dl>
      <p>{{ metricGuide.reading }}</p>
      <p class="rating-guide-scale">{{ metricGuide.scale }}</p>
      <p>{{ metricGuide.combat }}</p>
    </details>

    <p v-if="loading" class="rating-state" role="status">正在读取并校验{{ profile === 'standard' ? '标准' : '快速' }}档结果……</p>
    <div v-else-if="failure" class="rating-state rating-error" role="alert"><p>{{ failure }}。未加载的数据不会生成等级。</p><button type="button" @click="retry++"><RefreshCw :size="16" />重新读取</button></div>
    <template v-else-if="dataset">
      <section class="rating-board" aria-labelledby="rating-board-title">
        <div class="rating-section-heading"><h2 id="rating-board-title">{{ currentGroup }} · {{ ratingRoles[role] }}</h2><span>已评级 {{ rankedCount }} / {{ rows.length }}</span></div>
        <p class="rating-caption">{{ gradeCaption }}。同分按未封顶综合值、模板 ID 排序。点选对象后，<button class="rating-jump" type="button" @click="scrollTo(detailSection)">查看所选对象的八维能力 ↓</button></p>
        <div v-for="tier in tiers" :key="tier.grade" class="rating-tier" :data-grade="tier.grade">
          <div class="rating-tier-label"><strong>{{ tier.grade }}</strong><span>{{ tier.rows.length }}</span></div>
          <div class="rating-members">
            <button v-for="row in tier.rows" :key="row.id" type="button" class="rating-member" :aria-pressed="selected?.id === row.id" :title="row.id" @click="selectedId = row.id">
              <img v-if="image(row)" :src="image(row)" alt="" loading="lazy" /><span class="rating-member-name">{{ row.name.replace(/ · (近战|远程)$/, '') }}</span><b>{{ ratingNumber(row.ratings[role].value) }}</b>
            </button>
          </div>
        </div>
        <p v-if="!rows.length" class="rating-state">没有匹配的对象。请调整类别或搜索词。</p>
      </section>

      <section v-if="selected" ref="detailSection" class="rating-detail" aria-labelledby="rating-detail-title">
        <div class="rating-section-heading"><div><h2 id="rating-detail-title">{{ selected.name }}</h2><code>{{ selected.id }}</code></div><span>{{ selected.successfulTrials }} 轮成功<span v-if="selected.failedTrials"> · {{ selected.failedTrials }} 轮失败</span></span></div>
        <p v-if="selected.primaryAvailable === false" class="rating-notice">本模式没有对应的主体普攻；当前站位下仍保留自动技能与召唤物，不能把其总输出解释为该类普攻输出。</p>
        <p v-if="selected.state !== 'complete'" class="rating-notice">此对象的关卡前置条件或原生脚本尚未适配，本次不生成等级。失败不等于零能力。</p>
        <div class="rating-role-scores"><div v-for="(label, id) in ratingRoles" :key="id"><span>{{ label }}评价</span><strong>{{ selected.ratings[id].grade }}</strong><small>{{ ratingNumber(selected.ratings[id].value) }} 分</small></div></div>
        <div class="rating-evidence-grid">
          <svg class="rating-radar" viewBox="0 0 400 390" role="img" :aria-label="selected.name + '八维雷达图'">
            <polygon v-for="n in 5" :key="n" :points="ring(n * 20)" class="rating-radar-grid" />
            <g v-for="(key, i) in axes" :key="key"><line x1="200" y1="192" :x2="point(i, 100)[0]" :y2="point(i, 100)[1]" class="rating-radar-grid" /><text :x="labelPoint(i)[0]" :y="labelPoint(i)[1] + 5" text-anchor="middle">{{ ratingAxes[key] }}</text></g>
            <polygon v-if="polygon" :points="polygon" class="rating-radar-shape" />
            <template v-for="(key, i) in axes" :key="key"><circle v-if="selected.scores[key].value !== null" :cx="point(i, selected.scores[key].value!)[0]" :cy="point(i, selected.scores[key].value!)[1]" r="3" class="rating-radar-dot" /></template>
          </svg>
          <div class="rating-table-wrap"><table class="rating-table"><caption>八维能力与固定参照</caption><thead><tr><th>维度</th><th>实测指标</th><th>固定参照</th><th>分数</th><th>等级</th></tr></thead><tbody><tr v-for="key in axes" :key="key"><th>{{ ratingAxes[key] }}</th><td>{{ ratingNumber(selected.scores[key].raw, true) }}</td><td>{{ ratingNumber(selected.scores[key].reference, true) }}</td><td>{{ ratingNumber(selected.scores[key].value) }}</td><td>{{ selected.scores[key].grade }}</td></tr></tbody></table></div>
        </div>
        <details class="rating-provenance"><summary>原版最高、中位数与种子波动</summary>
          <p>仅比较当前类别的成功原版对象；中位数包含真实零值，与评分使用的正值中位数不同。未封顶分保留超出100分的幅度。观测范围不是置信区间；跨等级线表示该项对种子敏感。</p>
          <div class="rating-table-wrap"><table class="rating-table"><thead><tr><th>维度</th><th>未封顶分</th><th>原版最高者 / 指标</th><th>较最高</th><th>原版中位数</th><th>较中位</th><th>种子数 / 观测范围</th></tr></thead><tbody><tr v-for="c in comparison" :key="c.key"><th>{{ c.label }}</th><td>{{ ratingNumber(selected.scores[c.key]?.uncapped) }}</td><td>{{ c.top }} / {{ ratingNumber(c.best,true) }}</td><td>{{ c.versusTop }}</td><td>{{ ratingNumber(c.median,true) }}</td><td>{{ c.versusMedian }}</td><td v-if="selected.variation?.[c.key]">{{ selected.variation[c.key]!.n }} / {{ ratingNumber(selected.variation[c.key]!.min,true) }}–{{ ratingNumber(selected.variation[c.key]!.max,true) }}<strong v-if="selected.variation[c.key]!.crossesGrade"> · 跨等级线</strong></td><td v-else>归档未提供；见逐轮证据</td></tr></tbody></table></div>
        </details>
        <button type="button" class="rating-jump" @click="downloadFeedback">下载本对象反馈资料（填写现象后自行提交）</button>
        <p v-if="selected.annotation" class="rating-caption">{{ selected.annotation }}</p>
        <div class="rating-links"><a :href="evidenceUrl" download><Download :size="15" />逐轮原始证据（JSON.gz）</a><a :href="feedbackUrl" target="_blank" rel="noopener noreferrer"><ExternalLink :size="15" />反馈机制与遗漏</a></div>
        <details class="rating-provenance"><summary>站位、前置条件与证据校验</summary><dl><template v-for="(value, key) in selected.notes" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template><dt v-if="selected.cost !== null">金币成本</dt><dd v-if="selected.cost !== null">{{ ratingNumber(selected.cost, true) }}</dd><dt>原始 JSON SHA-256</dt><dd><code>{{ selected.evidence.sha256 }}</code></dd></dl><pre v-if="selected.errors.length">{{ selected.errors.join('\n\n') }}</pre><p>下载后解压可查看每场景、种子、普通伤害、秒杀、普攻与召唤物证据。原始文件中的采集时临时分数，可能与最终完整参照重新计算的天梯分数不同。</p></details>
      </section>
    </template>

    <div class="rating-links"><button type="button" :aria-expanded="showExperiments" @click="showExperiments=!showExperiments">独立实验室（机动、辅助、生存与同预算）</button></div>
    <ExperimentViewer v-if="showExperiments" />
    <section id="rating-methods" ref="methodsSection" class="rating-methods" aria-labelledby="rating-method-title">
      <h2 id="rating-method-title">测评标准与专业玩家审阅</h2>
      <p>各轴正值中位数对应 70 分：<code>min(100, 70 × √(实测指标 / 固定参照))</code>。英雄近远程共用英雄参照；塔只以本档常规最终阶级塔建立参照。缺失与失败不填零分。</p>
      <div class="rating-table-wrap"><table class="rating-table rating-weights"><tbody><tr v-for="(label, id) in ratingRoles" :key="id"><th>{{ label }}</th><td>{{ roleWeights(id) }}</td></tr></tbody></table></div>
      <p class="rating-caption">手动大招、复杂地形、特殊敌人、长冷却、成长和阵容协同仍需补充测试。等级针对当前固定靶场，不代表玩家操作上限或完整 Boss 战胜率。</p>
      <details><summary>展开完整标准、场景参数、已知局限与反馈清单</summary><div class="rating-method-text" v-html="methodology.html"></div></details>
      <div class="rating-links"><a :href="ratingAssetUrl('rating/methodology.md', methodology.sha256)" download>下载完整测评标准</a><a :href="feedbackUrl" target="_blank" rel="noopener noreferrer">提交可复现的修正建议</a></div>
      <details v-if="dataset" class="rating-provenance"><summary>本档版本、采集协议与源文件指纹</summary><p>批次 <code>{{ dataset.summary.runId }}</code></p><p>游戏提交 <code>{{ dataset.summary.commitHash }}</code></p><p>{{ dataset.summary.protocol }} / {{ dataset.summary.mobilityProtocol }}</p><p>源汇总 SHA-256 <code>{{ dataset.provenance.sourceSummarySha256 }}</code></p><pre>{{ JSON.stringify(dataset.provenance.measurementSources, null, 2) }}</pre><a :href="file('evidence-manifest.json')" download>下载原始证据文件校验清单</a></details>
    </section>
  </section>
</template>

<style scoped>
.rating-page{padding:38px 0 56px;min-width:0}
.rating-heading{display:flex;justify-content:space-between;gap:32px;align-items:center;margin-bottom:28px}
.rating-heading h1{font-size:42px;line-height:1.2;margin:12px 0 16px;letter-spacing:-.04em}
.rating-heading h1 em{color:var(--gold);font-style:normal}
.rating-heading p{max-width:740px;margin:0;color:var(--muted);font-size:15px}
.rating-stamp{flex-shrink:0;display:grid;grid-template-columns:30px auto;gap:4px 12px;color:var(--gold)}
.rating-stamp svg{grid-row:span 2;align-self:center}
.rating-stamp strong{font-size:17px}
.rating-stamp span{font-size:12px;color:var(--muted)}
.rating-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--line);padding:20px 0;gap:24px}
.rating-facts div{display:grid;gap:5px}
.rating-facts strong{font-size:26px;color:var(--ink);font-weight:650;font-variant-numeric:tabular-nums}
.rating-facts span{font-size:12px;color:var(--muted)}
.rating-notice{margin:24px 0;padding:12px 16px;border-left:3px solid var(--gold-soft);background:#e4c18408;color:var(--muted);line-height:1.8;font-size:13px}
.rating-controls{display:flex;gap:16px;flex-wrap:wrap;align-items:end;margin-top:28px}
.rating-controls label{display:grid;gap:8px;min-width:150px;font-size:12px;color:var(--muted)}
.rating-controls select,.rating-controls input{width:100%;height:44px;border:1px solid var(--line-bright);border-radius:7px;background:var(--panel);color:var(--ink);padding:8px 12px;font-size:14px}
.rating-search{flex:1}
.rating-links{display:flex;align-items:center;gap:12px 22px;flex-wrap:wrap;margin:18px 0;font-size:13px}
.rating-links button{background:none;border:0;padding:0;cursor:pointer}
.rating-jump{color:var(--gold);text-decoration:underline;text-underline-offset:3px;background:none;border:0;padding:0;cursor:pointer}
.rating-detail{scroll-margin-top:130px}
.rating-links a,.rating-links button{display:inline-flex;align-items:center;gap:7px;color:var(--gold);text-underline-offset:4px;text-decoration:underline}
.rating-links a:hover,.rating-links button:hover{color:var(--ink)}
.rating-guide{margin:24px 0;padding:4px 20px;border:1px solid var(--line-bright);border-radius:10px;background:var(--panel)}
.rating-page .rating-guide>summary{font-size:16px;font-weight:600}
.rating-guide p{font-size:13px;color:var(--muted);line-height:1.85;margin:14px 0}
.rating-guide-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0}
.rating-guide-list>div{padding:16px;border:1px solid var(--line);border-radius:6px;min-width:0}
.rating-guide-list dt{font-size:16px;font-weight:600;color:var(--gold);line-height:1.7}
.rating-guide-list dt span{display:block;font-size:14px;font-weight:500;color:var(--ink);margin-top:4px}
.rating-guide-list dd{margin:8px 0 0;font-size:13px;color:var(--muted);line-height:1.85;overflow-wrap:anywhere}
.rating-guide p.rating-guide-scale{color:var(--gold);padding:12px 14px;background:#e4c18408;border-left:2px solid var(--gold-soft)}
.rating-board,.rating-detail,.rating-methods{margin-top:32px;padding:24px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.rating-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
.rating-section-heading h2,.rating-methods h2{margin:0;font-size:21px;color:var(--ink)}
.rating-section-heading>span{font-size:12px;color:var(--muted);flex-shrink:0}
.rating-section-heading code{font-size:12px;color:var(--faint);overflow-wrap:anywhere}
.rating-caption{font-size:12px;color:var(--muted);margin:13px 0 20px;line-height:1.8}
.rating-tier{display:grid;grid-template-columns:60px minmax(0,1fr);gap:12px;margin-top:12px}
.rating-tier-label{display:flex;flex-direction:column;justify-content:center;align-items:center;background:#3c4744;border-radius:6px;gap:2px;color:#f4f1e9}
.rating-tier-label strong{font-size:26px}
.rating-tier-label span{font-size:11px;opacity:.8}
.rating-tier[data-grade=S] .rating-tier-label{background:#71542e}
.rating-tier[data-grade=A] .rating-tier-label{background:#345843}
.rating-tier[data-grade=B] .rating-tier-label{background:#37546a}
.rating-tier[data-grade=C] .rating-tier-label{background:#564461}
.rating-tier[data-grade=D] .rating-tier-label{background:#5a5042}
.rating-tier[data-grade=未评测] .rating-tier-label strong{font-size:14px}
.rating-members{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:8px}
.rating-member{display:flex;align-items:center;gap:10px;min-height:64px;border:1px solid var(--line);border-radius:6px;background:#10171165;text-align:left;padding:10px;color:var(--ink);cursor:pointer;min-width:0}
.rating-member img{width:34px;height:38px;object-fit:contain;flex-shrink:0}
.rating-member-name{font-size:13px;overflow-wrap:anywhere;line-height:1.5;flex:1}
.rating-member b{font-size:13px;font-variant-numeric:tabular-nums;flex-shrink:0;color:var(--gold)}
.rating-member[aria-pressed=true]{border-color:var(--gold-soft);background:#e4c1840b}
.rating-member:hover{border-color:var(--muted)}
.rating-state{padding:24px 0;color:var(--muted)}
.rating-error{color:var(--red)}
.rating-state button{display:flex;gap:8px;align-items:center;color:var(--ink);border:1px solid var(--line-bright);border-radius:6px;background:var(--panel);padding:8px 12px}
.rating-role-scores{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:24px 0;border-block:1px solid var(--line);padding:15px 0;gap:16px}
.rating-role-scores div{display:flex;align-items:baseline;gap:12px}
.rating-role-scores span,.rating-role-scores small{font-size:12px;color:var(--muted)}
.rating-role-scores strong{font-size:23px;color:var(--gold)}
.rating-evidence-grid{display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:32px;align-items:center}
.rating-radar{width:100%;max-width:400px;height:auto;overflow:visible}
.rating-radar text{font-size:13px;fill:var(--muted)}
.rating-radar-grid{fill:none;stroke:var(--line-bright);stroke-width:1}
.rating-radar-shape{fill:#9dc7a71c;stroke:var(--green);stroke-width:2}
.rating-radar-dot{fill:var(--green)}
.rating-table-wrap{overflow-x:auto;min-width:0}
.rating-table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap;min-width:450px}
.rating-table caption{text-align:left;color:var(--muted);padding:0 12px 12px;font-size:12px}
.rating-table td,.rating-table th{padding:11px 12px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
.rating-table th{font-weight:500;color:var(--muted)}
.rating-table th:first-child{text-align:left}
.rating-table td{color:var(--ink)}
.rating-table thead th{font-size:12px;color:var(--faint)}
.rating-weights{min-width:0;white-space:normal;margin:16px 0}
.rating-weights td{text-align:left}
.rating-weights th{width:70px}
.rating-methods>p{font-size:14px;line-height:1.85;color:var(--muted)}
.rating-provenance{margin-top:20px;color:var(--muted);font-size:13px}
.rating-provenance dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:12px;margin-top:20px}
.rating-provenance dt{color:var(--faint)}
.rating-provenance dd{margin:0;overflow-wrap:anywhere}
.rating-provenance p{line-height:1.8}
.rating-page code{overflow-wrap:anywhere;font-size:12px}
.rating-page pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;padding:16px;border:1px solid var(--line);background:#10171165;font-size:12px}
.rating-page summary{cursor:pointer;color:var(--gold);font-size:14px;padding:12px 0;scroll-margin-top:140px}
.rating-methods{scroll-margin-top:130px}
.rating-method-text{color:var(--muted);font-size:14px;line-height:1.9}
.rating-method-text :deep(h1){font-size:24px;margin:28px 0 16px;color:var(--ink)}
.rating-method-text :deep(h2){font-size:20px;margin:30px 0 14px;color:var(--ink)}
.rating-method-text :deep(h3){font-size:17px;margin:24px 0 10px}
.rating-method-text :deep(p){margin:14px 0}
.rating-method-text :deep(ul),.rating-method-text :deep(ol){padding-left:22px;list-style:disc}
.rating-method-text :deep(li){margin:7px 0}
.rating-method-text :deep(strong){color:var(--ink)}
.rating-method-text :deep(.methods-table){overflow:auto;margin:18px 0}
.rating-method-text :deep(table){border-collapse:collapse;min-width:520px;width:100%;font-size:13px}
.rating-method-text :deep(td),.rating-method-text :deep(th){padding:10px;border:1px solid var(--line);text-align:left}
.rating-method-text :deep(pre){font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.rating-method-text :deep(code){color:var(--ink);font-size:12px}

@media(max-width:1050px){.rating-evidence-grid{gap:12px;grid-template-columns:minmax(250px,340px) minmax(0,1fr)}
.rating-role-scores div{flex-wrap:wrap;gap:4px 12px}
.rating-heading{align-items:start}
}

@media(max-width:760px){.rating-heading{display:block}
.rating-heading h1{font-size:34px}
.rating-stamp{margin-top:24px;display:inline-grid}
.rating-facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.rating-facts strong{font-size:24px}
.rating-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.rating-controls label{min-width:0}
.rating-board,.rating-detail,.rating-methods{padding:16px}
.rating-guide{padding:4px 16px}
.rating-guide-list{grid-template-columns:1fr}
.rating-evidence-grid{grid-template-columns:1fr}
.rating-radar{margin:auto}
.rating-section-heading{align-items:start;flex-wrap:wrap}
.rating-members{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
.rating-tier{grid-template-columns:42px minmax(0,1fr);gap:8px}
.rating-tier-label strong{font-size:23px}
.rating-tier[data-grade=未评测] .rating-tier-label strong{font-size:12px;writing-mode:vertical-rl}
.rating-table{min-width:420px}
.rating-weights{min-width:0}
.rating-role-scores{gap:10px}
.rating-role-scores div{display:grid;gap:3px}
.rating-provenance dl{grid-template-columns:1fr;gap:6px}
.rating-provenance dd{margin-bottom:10px}
.rating-page{padding-top:26px}
.rating-notice{padding:10px 12px;font-size:12px}
.rating-member{gap:7px;padding:9px}
.rating-member img{width:28px;height:34px}
}

@media(prefers-reduced-motion:reduce){.rating-page *{scroll-behavior:auto}
}

</style>
