<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '../lib/calculator'
import type { DoveData, SupportLevel, Tower } from '../types'

const props = defineProps<{ data: DoveData }>()
defineEmits<{ open: [tower: Tower] }>()

const towerById = computed(() => new Map(props.data.towers.map((tower) => [tower.id, tower])))
const generatedAt = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(props.data.metadata.generatedAt)),
)

function describeLevel(level: SupportLevel) {
  const parts = [`半径 ${level.radius}`]
  if (level.damageBonus) parts.push(`伤害 +${formatPercent(level.damageBonus)}`)
  if (level.damagePerTrigger) parts.push(`每次伤害 +${formatPercent(level.damagePerTrigger)}`)
  if (level.rangeBonus) parts.push(`范围 +${formatPercent(level.rangeBonus)}`)
  if (level.speedBonus) parts.push(`攻速 +${formatPercent(level.speedBonus)}`)
  return parts.join(' · ')
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
          <div class="section-title"><span>玩家塔辅助矩阵</span><small>{{ data.summary.supportEffectCount }} 项效果 / {{ data.summary.supportTowerCount }} 座塔</small></div>
          <div class="support-matrix">
            <article v-for="effect in data.supportEffects" :key="effect.id">
              <button type="button" @click="$emit('open', towerById.get(effect.sourceTowerId)!)">
                <img :src="towerById.get(effect.sourceTowerId)?.image" :alt="effect.name" />
                <span><strong>{{ effect.name }}</strong><small>{{ towerById.get(effect.sourceTowerId)?.name }}</small></span>
              </button>
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
            <div><span>解锁关系</span><code>kr1/data/slot_template.lua + level*_data.lua</code></div>
            <div><span>辅助算法</span><code>all/script_utils.lua + tower_scripts.lua</code></div>
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
            <div><dt>显示版本</dt><dd>{{ data.metadata.gameVersion }}</dd></div>
            <div><dt>内部 ID</dt><dd>{{ data.metadata.gameId }}</dd></div>
            <div><dt>提交</dt><dd>{{ data.metadata.commitHash.slice(0, 12) }}</dd></div>
            <div><dt>游戏目录</dt><dd>{{ data.metadata.sourceRoot }}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </section>
</template>
