<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../lib/calculator'
import type { DoveData, SupportEffect, SupportLevel, Tower } from '../types'

const props = defineProps<{ data: DoveData; siteVersion: string }>()
const emit = defineEmits<{ open: [tower: Tower] }>()

const towerById = computed(() => new Map(props.data.towers.map((tower) => [tower.id, tower])))
const heroById = computed(() => new Map(props.data.heroes.map((hero) => [hero.id, hero])))
const generatedAt = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(props.data.metadata.generatedAt)),
)

function describeLevel(level: SupportLevel) {
  const parts = [level.radius ? `半径 ${level.radius}` : '全场']
  if (level.damageBonus) parts.push(`伤害 +${formatPercent(level.damageBonus)}`)
  if (level.damagePerTrigger) parts.push(`每次伤害 +${formatPercent(level.damagePerTrigger)}`)
  if (level.rangeBonus) parts.push(`范围 +${formatPercent(level.rangeBonus)}`)
  if (level.speedBonus) parts.push(`攻速 +${formatPercent(level.speedBonus)}`)
  if (level.cooldownMultiplier && level.cooldownMultiplier !== 1) {
    parts.push(`攻击间隔 ×${formatPercent(level.cooldownMultiplier)}`)
  }
  if (level.priceMultiplier && level.priceMultiplier !== 1) {
    parts.push(`价格 ×${level.priceMultiplier}`)
  }
  if (level.flatDps) parts.push(`额外 DPS +${level.flatDps}`)
  if (level.duration) parts.push(`持续 ${level.duration}s`)
  if (level.cycle) parts.push(`冷却 ${level.cycle}s`)
  return parts.join(' · ')
}

function supportIcon(effect: SupportEffect) {
  if (effect.icon) return effect.icon
  const tower = towerById.value.get(effect.sourceTowerId || '')
  return tower?.powers.find((power) => power.id === effect.skillId)?.icon || tower?.image
}

function supportSourceName(effect: SupportEffect) {
  return effect.sourceType === 'hero'
    ? `英雄 · ${heroById.value.get(effect.sourceHeroId || '')?.name || effect.sourceHeroId}`
    : `防御塔 · ${towerById.value.get(effect.sourceTowerId || '')?.name || effect.sourceTowerId}`
}

function openSupportSource(effect: SupportEffect) {
  if (effect.sourceType !== 'tower') return
  const tower = towerById.value.get(effect.sourceTowerId || '')
  if (tower) emit('open', tower)
}
</script>

<template>
  <section class="data-view page-width">
    <div class="page-heading split-heading data-heading">
      <div>
        <div class="eyebrow"><span></span> DATA PROVENANCE & VALIDATION</div>
        <h1>数据说明与<em>异常清单</em></h1>
        <p>所有展示字段来自当前 Dove 安装目录。运行时模板先由游戏自身展开，再规范化为 Wiki 数据。</p>
      </div>
      <div class="hash-card">
        <small>GAME COMMIT</small>
        <code>{{ data.metadata.commitHash }}</code>
        <span>同步于 {{ generatedAt }}</span>
      </div>
    </div>

    <div class="data-summary-grid">
      <article><span>塔模板</span><strong>{{ data.summary.towerCount }}</strong><small>去重后的玩家可选塔</small></article>
      <article><span>百科图像</span><strong>{{ data.summary.encyclopediaImageCount }}</strong><small>缩略图与详情图均来自游戏百科</small></article>
      <article><span>英雄名录</span><strong>{{ data.summary.heroCount }}</strong><small>按游戏英雄殿堂顺序同步</small></article>
      <article><span>敌人百科</span><strong>{{ data.summary.enemyCount }}</strong><small>{{ data.summary.uniqueEnemyCount }} 个唯一敌人，保留重复槽位</small></article>
      <article><span>精确伤害</span><strong>{{ data.summary.exactDamageCount }}</strong><small>调用游戏 info.fn 获取</small></article>
      <article class="warning"><span>解锁异常</span><strong>{{ data.summary.unlockAnomalyCount }}</strong><small>锁定但没有解锁关卡</small></article>
    </div>

    <div class="data-layout">
      <div class="data-main-column">
        <section class="data-card">
          <div class="section-title"><span>固定计算口径</span><small>BASELINE</small></div>
          <ol class="assumption-list">
            <li v-for="(assumption, index) in data.metadata.assumptions" :key="assumption">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <p>{{ assumption }}</p>
            </li>
          </ol>
        </section>

        <section class="data-card">
          <div class="section-title"><span>防御塔与英雄辅助矩阵</span><small>{{ data.summary.supportEffectCount }} 项效果 / {{ data.summary.supportTowerCount }} 座塔 + {{ data.summary.supportHeroCount }} 名英雄</small></div>
          <div class="support-matrix">
            <article v-for="effect in data.supportEffects" :key="effect.id">
              <component
                :is="effect.sourceType === 'tower' ? 'button' : 'div'"
                class="support-source"
                :type="effect.sourceType === 'tower' ? 'button' : undefined"
                @click="openSupportSource(effect)"
              >
                <img :src="supportIcon(effect)" :alt="`${effect.name}技能图标`" />
                <span><strong>{{ effect.name }}</strong><small>{{ supportSourceName(effect) }}</small></span>
              </component>
              <div class="level-pills">
                <span v-for="level in effect.levels" :key="level.level">Lv.{{ level.level }} · {{ describeLevel(level) }}</span>
              </div>
              <p>{{ effect.note }}</p>
            </article>
          </div>
        </section>

        <section class="data-card source-tree-card">
          <div class="section-title"><span>字段来源</span><small>TRACEABLE SOURCES</small></div>
          <div class="source-tree">
            <div><span>塔清单</span><code>kr1/game_settings.lua</code></div>
            <div><span>百科顺序</span><code>kr1-desktop/data/map_data.lua → tower_data</code></div>
            <div><span>模板属性</span><code>kr1/*_towers.lua + kr1/data/balance.lua</code></div>
            <div><span>名称描述</span><code>_assets/kr1-desktop/strings/zh-Hans.lua</code></div>
            <div><span>解锁关系</span><code>kr1/data/slot_template.lua + levels/level*.lua / level*_data.lua</code></div>
            <div><span>辅助算法</span><code>all/script_utils.lua + tower_scripts.lua</code></div>
            <div><span>科技树</span><code>kr1/upgrades.lua（{{ data.summary.technologyTreeCount }} 套 / {{ data.summary.technologyCount }} 项）</code></div>
            <div><span>英雄名录</span><code>map_data.lua → hero_data + kr1/heroes.lua（{{ data.summary.heroCount }} 名）</code></div>
            <div><span>敌人百科</span><code>game_settings.lua → encyclopedia_enemies（{{ data.summary.enemyCount }} 槽位 / {{ data.summary.uniqueEnemyCount }} 唯一）</code></div>
            <div><span>技能图标</span><code>tower_menus_data.lua + gui_ico.lua（{{ data.summary.skillIconCount }} 张）</code></div>
            <div><span>百科图集</span><code>encyclopedia.lua + encyclopedia_creeps.lua</code></div>
            <div><span>回退头像</span><code>gui_portraits.lua（{{ data.summary.portraitFallbackCount }} 座基础塔）</code></div>
          </div>
        </section>
      </div>

      <aside class="data-side-column">
        <section class="data-card warning-card">
          <div class="section-title"><span>校验警告</span><small>{{ data.validation.warnings.length }}</small></div>
          <ul>
            <li v-for="warning in data.validation.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </section>

        <section class="data-card anomaly-card">
          <div class="section-title"><span>无解锁关卡记录</span><small>{{ data.validation.unlockAnomalies.length }}</small></div>
          <p>这些塔存在于初始锁定表，但所有关卡数据均未声明解锁。Wiki 不推测关卡。</p>
          <div class="anomaly-list">
            <button
              v-for="towerId in data.validation.unlockAnomalies"
              :key="towerId"
              type="button"
              @click="$emit('open', towerById.get(towerId)!)"
            >
              <img :src="towerById.get(towerId)?.image" alt="" />
              <span><strong>{{ towerById.get(towerId)?.name }}</strong><code>{{ towerId }}</code></span>
            </button>
          </div>
        </section>

        <section class="data-card version-card">
          <div class="section-title"><span>数据快照</span><small>VERSION</small></div>
          <dl>
            <div><dt>站点版本</dt><dd>{{ siteVersion }}</dd></div>
            <div><dt>游戏版本</dt><dd>{{ data.metadata.gameVersion }}</dd></div>
            <div><dt>内容版本</dt><dd>{{ data.metadata.contentVersion }}</dd></div>
            <div><dt>内部 ID</dt><dd>{{ data.metadata.gameId }}</dd></div>
            <div><dt>提交</dt><dd>{{ data.metadata.commitHash.slice(0, 12) }}</dd></div>
            <div><dt>游戏目录</dt><dd>{{ data.metadata.sourceRoot }}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </section>
</template>
