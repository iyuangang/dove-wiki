<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { Hero, SupportEffect } from '../types'

const props = defineProps<{ heroes: Hero[]; effects: SupportEffect[] }>()

const query = ref('')
const sourceGame = ref(0)
const supportOnly = ref(false)
const profileLabels = ['耐久', '近战', '远程', '技能']
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
    return !needle || [hero.name, hero.id, ...hero.specialties].some((text) => text.toLowerCase().includes(needle))
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
</script>

<template>
  <section class="hero-view page-width">
    <div class="page-heading split-heading hero-page-heading">
      <div>
        <div class="eyebrow"><span></span> HERO HALL</div>
        <h1>英雄殿堂<em>档案</em></h1>
        <p>按游戏英雄殿堂顺序整理 {{ heroes.length }} 位英雄，展示满级核心属性、定位与技能成长。可影响防御塔的英雄已接入辅助计算台。</p>
      </div>
      <div class="hero-support-callout">
        <strong>{{ supportByHero.size }}</strong>
        <span>位英雄可影响矩阵</span>
        <small>{{ effects.filter((effect) => effect.sourceType === 'hero').length }} 项可计算效果</small>
      </div>
    </div>

    <section class="hero-toolbar">
      <label class="hero-search">
        <span>搜索英雄、内部 ID 或定位</span>
        <input v-model="query" type="search" placeholder="例如：迪纳斯 / 远程 / hero_denas" />
      </label>
      <label>
        <span>来源作品</span>
        <select v-model="sourceGame">
          <option :value="0">全部作品</option>
          <option v-for="game in sourceGames" :key="game" :value="game">王国保卫战 {{ game }}</option>
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
      <button v-if="query || sourceGame || supportOnly" type="button" @click="query = ''; sourceGame = 0; supportOnly = false">清除筛选</button>
    </div>

    <div class="hero-grid">
      <article v-for="hero in filteredHeroes" :key="hero.id" class="hero-card">
        <div class="hero-card-visual">
          <img :src="hero.image" :alt="`${hero.name}英雄立绘`" loading="lazy" />
          <Badge class="hero-game-badge" variant="outline">KR {{ hero.sourceGame }}</Badge>
          <Badge v-if="supportByHero.has(hero.id)" class="hero-buff-badge">辅助矩阵</Badge>
        </div>

        <div class="hero-card-body">
          <div class="hero-name-row">
            <div><h2>{{ hero.name }}</h2><code>{{ hero.id }}</code></div>
            <span>初始 Lv.{{ hero.startingLevel }}</span>
          </div>
          <p class="hero-description">{{ hero.description }}</p>

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
            <div><dt>技能成长</dt><dd>{{ hero.skills.length }} 条</dd></div>
          </dl>

          <div v-if="supportByHero.has(hero.id)" class="hero-support-effects">
            <small>可计入辅助计算</small>
            <span v-for="effect in supportByHero.get(hero.id)" :key="effect.id">{{ effect.name }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-if="!filteredHeroes.length" class="empty-state">
      <strong>没有符合条件的英雄</strong>
      <p>换一个关键词或清除筛选后再试。</p>
    </div>
  </section>
</template>
