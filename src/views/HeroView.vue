<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { Hero, SupportEffect } from '../types'

const props = defineProps<{ heroes: Hero[]; effects: SupportEffect[]; dataVersion: string }>()

const query = ref('')
const sourceGame = ref(0)
const supportOnly = ref(false)
const movementFilter = ref('')
const movementOptions = computed(() => [...new Set(props.heroes.flatMap((hero) => hero.details.movement.tags))])
const selectedHero = ref<Hero | null>(null)
const profileLabels = ['耐久', '近战', '远程', '技能']
const sourceNames: Record<number, string> = {
  1: '王国保卫战',
  2: '前线',
  3: '起源',
  4: '复仇',
  5: '联盟',
}
const supportByHero = computed(() => {
  const map = new Map<string, SupportEffect[]>()
  for (const effect of props.effects.filter((item) => item.sourceType === 'hero')) {
    const heroId = effect.sourceHeroId || ''
    map.set(heroId, [...(map.get(heroId) || []), effect])
  }
  return map
})
const sourceGames = computed(() =>
  [...new Set(props.heroes.map((hero) => hero.sourceGame))].sort((left, right) => left - right),
)
const filteredHeroes = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return props.heroes.filter((hero) => {
    if (sourceGame.value && hero.sourceGame !== sourceGame.value) return false
    if (supportOnly.value && !supportByHero.value.has(hero.id)) return false
    if (movementFilter.value && !hero.details.movement.tags.includes(movementFilter.value)) return false
    return !needle || [
      hero.name,
      hero.id,
      ...hero.specialties,
      ...hero.abilities.map((ability) => ability.description),
      hero.details.movement.label,
      ...hero.details.items.flatMap((item) => [item.title, item.summary, ...item.facts]),
    ].some((text) => text.toLowerCase().includes(needle))
  })
})

function damageLabel(hero: Hero) {
  const melee = hero.maxStats.meleeDamageMin == null
    ? null
    : `${hero.maxStats.meleeDamageMin}–${hero.maxStats.meleeDamageMax}`
  const ranged = hero.maxStats.rangedDamageMin == null
    ? null
    : `${hero.maxStats.rangedDamageMin}–${hero.maxStats.rangedDamageMax}`
  if (melee && ranged) return `近 ${melee} / 远 ${ranged}`
  return melee || ranged || '—'
}

function armorLabel(hero: Hero) {
  const armor = hero.maxStats.armor == null ? [] : [`物 ${Math.round(hero.maxStats.armor * 100)}%`]
  if (hero.maxStats.magicArmor != null) armor.push(`魔 ${Math.round(hero.maxStats.magicArmor * 100)}%`)
  return armor.join(' / ') || '—'
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') selectedHero.value = null
}

watch(selectedHero, (hero) => {
  document.body.classList.toggle('modal-open', Boolean(hero))
  if (hero) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open')
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section class="hero-view page-width">
    <div class="page-heading split-heading hero-page-heading">
      <div>
        <div class="eyebrow"><span></span> HERO HALL</div>
        <h1>英雄殿堂<em>档案</em></h1>
        <p>按游戏英雄殿堂顺序整理 {{ heroes.length }} 位英雄。查看移动方式、调动条件、实战特性、技能说明与成长节点；可影响防御塔的英雄已接入辅助计算台。</p>
        <p class="hero-behavior-note">英雄档案来源：游戏 v{{ dataVersion }}。飞行筛选仅包含常驻飞行英雄；技能解锁后的移动能力也会列入对应分类。</p>
      </div>
      <div class="hero-support-callout">
        <strong>{{ supportByHero.size }}</strong>
        <span>位英雄可影响矩阵</span>
        <small>{{ effects.filter((effect) => effect.sourceType === 'hero').length }} 项可计算效果</small>
      </div>
    </div>

    <section class="hero-toolbar">
      <label class="hero-search">
        <span>搜索英雄、技能、移动方式或特性</span>
        <input v-model="query" type="search" placeholder="例如：迪纳斯 / 远程 / hero_denas" />
      </label>
      <label>
        <span>来源作品</span>
        <select v-model="sourceGame">
          <option :value="0">全部作品</option>
          <option v-for="game in sourceGames" :key="game" :value="game">
            {{ sourceNames[game] || `作品 ${game}` }}
          </option>
        </select>
      </label>
      <label>
        <span>移动方式</span>
        <select v-model="movementFilter">
          <option value="">全部移动方式</option>
          <option v-for="movement in movementOptions" :key="movement" :value="movement">{{ movement }}</option>
        </select>
      </label>
      <Button
        type="button"
        :variant="supportOnly ? 'default' : 'outline'"
        class="hero-support-filter"
        @click="supportOnly = !supportOnly"
      >
        {{ supportOnly ? '正在查看辅助英雄' : '只看辅助英雄' }}
      </Button>
    </section>

    <div class="hero-results-line">
      <span>显示 {{ filteredHeroes.length }} / {{ heroes.length }} 位英雄</span>
      <button v-if="query || sourceGame || supportOnly || movementFilter" type="button" @click="query = ''; sourceGame = 0; supportOnly = false; movementFilter = ''">清除筛选</button>
    </div>

    <div class="hero-grid">
      <article v-for="hero in filteredHeroes" :key="hero.id" class="hero-card">
        <button
          type="button"
          class="hero-card-hit"
          :aria-label="`查看${hero.name}英雄详情`"
          @click="selectedHero = hero"
        >
          <div class="hero-card-visual">
            <img :src="hero.image" :alt="`${hero.name}英雄立绘`" loading="lazy" />
            <Badge class="hero-game-badge" variant="outline">{{ sourceNames[hero.sourceGame] || `KR ${hero.sourceGame}` }}</Badge>
            <Badge v-if="supportByHero.has(hero.id)" class="hero-buff-badge">辅助矩阵</Badge>
            <span class="hero-open-label">查看完整档案</span>
          </div>

          <div class="hero-card-body">
            <div class="hero-name-row">
              <div><h2>{{ hero.name }}</h2><code>{{ hero.id }}</code></div>
              <span>初始 Lv.{{ hero.startingLevel }}</span>
            </div>
            <p class="hero-description">{{ hero.description }}</p>
            <p class="hero-movement-label">{{ hero.details.movement.label }} <span>基础移速 {{ hero.details.movement.baseSpeed ?? '—' }}</span></p>

            <div class="hero-specialties">
              <span v-for="specialty in hero.specialties" :key="specialty">{{ specialty }}</span>
            </div>

            <div class="hero-profile-bars">
              <div v-for="(value, index) in hero.profileStats" :key="profileLabels[index]">
                <span>{{ profileLabels[index] }}</span>
                <i><b :style="{ width: `${Math.min(value, 10) * 10}%` }"></b></i>
                <strong>{{ value }}</strong>
              </div>
            </div>

            <dl class="hero-max-stats">
              <div><dt>满级生命</dt><dd>{{ hero.maxStats.hp ?? '—' }}</dd></div>
              <div><dt>满级护甲</dt><dd>{{ armorLabel(hero) }}</dd></div>
              <div><dt>满级伤害</dt><dd>{{ damageLabel(hero) }}</dd></div>
              <div><dt>技能介绍</dt><dd>{{ hero.abilities.length }} 项</dd></div>
            </dl>

            <div v-if="supportByHero.has(hero.id)" class="hero-support-effects">
              <small>可计入辅助计算</small>
              <span v-for="effect in supportByHero.get(hero.id)" :key="effect.id">{{ effect.name }}</span>
            </div>
          </div>
        </button>
      </article>
    </div>

    <div v-if="!filteredHeroes.length" class="empty-state">
      <strong>没有符合条件的英雄</strong>
      <p>换一个关键词或清除筛选后再试。</p>
    </div>
  </section>

  <Teleport to="body">
    <Transition name="panel">
      <div v-if="selectedHero" class="hero-detail-overlay" role="presentation" @mousedown.self="selectedHero = null">
        <aside class="hero-detail-panel" role="dialog" aria-modal="true" :aria-label="`${selectedHero.name}英雄详情`">
          <Button type="button" variant="ghost" class="hero-detail-close" aria-label="关闭英雄详情" @click="selectedHero = null">×</Button>

          <div class="hero-detail-hero">
            <div class="hero-detail-image">
              <img :src="selectedHero.image" :alt="`${selectedHero.name}英雄立绘`" />
            </div>
            <div>
              <div class="eyebrow"><span></span> {{ sourceNames[selectedHero.sourceGame] || `KR ${selectedHero.sourceGame}` }}</div>
              <h2>{{ selectedHero.name }}</h2>
              <code>{{ selectedHero.id }}</code>
              <div class="hero-detail-badges">
                <Badge variant="outline">初始 Lv.{{ selectedHero.startingLevel }}</Badge>
                <Badge variant="secondary">登场关卡 {{ selectedHero.availableLevel }}</Badge>
                <Badge v-if="supportByHero.has(selectedHero.id)">辅助矩阵</Badge>
              </div>
            </div>
          </div>

          <p class="hero-detail-description">{{ selectedHero.description }}</p>

          <dl class="hero-detail-stats">
            <div><dt>满级生命</dt><dd>{{ selectedHero.maxStats.hp ?? '—' }}</dd></div>
            <div><dt>满级护甲</dt><dd>{{ armorLabel(selectedHero) }}</dd></div>
            <div><dt>满级伤害</dt><dd>{{ damageLabel(selectedHero) }}</dd></div>
            <div><dt>技能数量</dt><dd>{{ selectedHero.abilities.length }}</dd></div>
          </dl>

          <section class="hero-detail-section">
            <div class="hero-detail-title">
              <strong>移动与基础行为</strong>
              <small>{{ selectedHero.details.movement.label }}</small>
            </div>
            <dl class="hero-behavior-stats">
              <div><dt>基础移速</dt><dd>{{ selectedHero.details.movement.baseSpeed ?? '—' }} <small>游戏距离 / 秒</small></dd></div>
              <div><dt>基础复活等待</dt><dd>{{ selectedHero.details.respawnSeconds ?? '—' }} 秒</dd></div>
              <div><dt>回血周期参数</dt><dd>{{ selectedHero.details.regenInterval ?? '—' }} 秒</dd></div>
              <div><dt>受击后回血等待参数</dt><dd>{{ selectedHero.details.regenHitDelay ?? '—' }} 秒</dd></div>
            </dl>
            <p class="hero-behavior-note">模板基准值，未计升级、变身与外部增益。复活还有动作耗时，特殊复活机制可覆盖基础等待；回血周期仅在恢复逻辑运行时累计，不能据此视为战斗中每秒回血。</p>
            <div class="hero-behavior-attacks">
              <div v-for="attack in selectedHero.details.attacks" :key="attack.kind">
                <strong>{{ attack.kind }}主攻击</strong>
                <span>冷却 {{ attack.cooldown ?? '—' }} 秒 · {{ attack.kind === '近战' ? '接敌距离' : '射程' }} {{ attack.range ?? '—' }}</span>
                <span v-if="attack.minRange != null">最短射程 {{ attack.minRange }}</span>
                <small v-if="attack.disabled">模板默认未启用</small>
              </div>
            </div>
            <p class="hero-behavior-note">主攻击指对应攻击列表的首项，冷却不含走位与动作耗时；特殊脚本可能使用独立攻击逻辑。</p>
            <details class="unit-source">
              <summary>基础参数与寻路依据</summary>
              <p>默认可经过：{{ selectedHero.details.movement.terrain.join('、') || '未提供' }}</p>
              <p>默认可选目的地：{{ selectedHero.details.movement.destinations.join('、') || '未提供' }}</p>
              <p>以上为模板地形许可，实际落点还受地图与关卡限制；技能解锁后的变化见下方条目。</p>
              <code v-for="source in selectedHero.details.sources" :key="source.symbol">{{ source.file }}:{{ source.line ?? '?' }} · {{ source.symbol }}</code>
            </details>
          </section>

          <section class="hero-detail-section">
            <div class="hero-detail-title">
              <strong>移动机制与实战特性</strong>
              <small>{{ selectedHero.details.items.length }} 条已核实 · v{{ selectedHero.details.reviewedVersion }}</small>
            </div>
            <p class="hero-behavior-note">根据实际行为脚本整理；这里列出已核实的机制，未收录不代表没有其他特性。特殊移动不等同于常驻飞行。</p>
            <p v-if="selectedHero.details.pending.length" class="hero-behavior-note">源码已变动，以下说明等待重新核实：{{ selectedHero.details.pending.join('、') }}</p>
            <div class="hero-trait-list">
              <article v-for="item in selectedHero.details.items" :key="item.id">
                <h3>{{ item.title }}</h3>
                <p>{{ item.summary }}</p>
                <ul v-if="item.facts.length"><li v-for="fact in item.facts" :key="fact">{{ fact }}</li></ul>
                <details class="unit-source">
                  <summary>查看源码依据</summary>
                  <code v-for="source in item.sources" :key="source.file + source.symbol">{{ source.file }}:{{ source.line ?? '?' }} · {{ source.symbol }}</code>
                </details>
              </article>
            </div>
            <p v-if="!selectedHero.details.items.length && !selectedHero.details.pending.length" class="hero-behavior-note">已提供模板移动参数；本英雄专属被动尚未逐项核实。</p>
          </section>

          <section class="hero-detail-section">
            <div class="hero-detail-title">
              <strong>技能介绍</strong>
              <small>取自游戏英雄殿堂的满级技能说明</small>
            </div>
            <div v-if="selectedHero.abilities.length" class="hero-ability-list">
              <article v-for="(ability, index) in selectedHero.abilities" :key="`${selectedHero.id}-${ability.name}`">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <strong>{{ ability.name }}</strong>
                  <p>{{ ability.description }}</p>
                </div>
              </article>
            </div>
            <p v-else class="empty-copy">游戏英雄殿堂未提供独立技能说明。</p>
          </section>

          <section v-if="selectedHero.skills.length" class="hero-detail-section">
            <div class="hero-detail-title">
              <strong>技能成长节点</strong>
              <small>英雄等级 → 技能等级</small>
            </div>
            <div class="hero-skill-growth">
              <article v-for="skill in selectedHero.skills" :key="skill.id">
                <code>{{ skill.id }}</code>
                <strong>最高 {{ skill.maxLevel }} 级</strong>
                <span v-if="skill.unlockLevels.length">
                  {{ skill.unlockLevels.map((entry) => `Lv.${entry.heroLevel} → ${entry.skillLevel}`).join(' · ') }}
                </span>
                <span v-else>随英雄等级自动成长</span>
              </article>
            </div>
          </section>

          <section v-if="supportByHero.has(selectedHero.id)" class="hero-detail-section">
            <div class="hero-detail-title">
              <strong>辅助矩阵效果</strong>
              <small>可在辅助计算页选择</small>
            </div>
            <div class="hero-detail-support">
              <Badge v-for="effect in supportByHero.get(selectedHero.id)" :key="effect.id" variant="secondary">
                {{ effect.name }}
              </Badge>
            </div>
          </section>

          <section class="hero-detail-section hero-detail-source">
            <div class="hero-detail-title"><strong>数据来源</strong><small>字段可追溯</small></div>
            <code>{{ selectedHero.sources.roster }}</code>
            <code>{{ selectedHero.sources.template }}</code>
            <code>{{ selectedHero.sources.localization }}</code>
          </section>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
