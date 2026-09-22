<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { familyLabels } from '../data'
import { formatNumber } from '../lib/calculator'
import type { Tower } from '../types'
import TowerUnitCard from './TowerUnitCard.vue'
import TowerMechanics from './TowerMechanics.vue'

const props = defineProps<{ tower: Tower | null }>()
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.tower,
  (tower) => {
    document.body.classList.toggle('modal-open', Boolean(tower))
    if (tower) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open')
  window.removeEventListener('keydown', onKeydown)
})

</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="tower" class="detail-overlay" role="presentation" @mousedown.self="$emit('close')">
        <section class="detail-panel" role="dialog" aria-modal="true" :aria-label="`${tower.name}详情`">
          <button class="close-button" type="button" aria-label="关闭详情" @click="$emit('close')">×</button>

          <div class="detail-hero">
            <div class="detail-portrait">
              <img :src="tower.encyclopediaImage" :alt="`${tower.name}${tower.encyclopediaListed ? '百科插图' : '头像'}`" />
            </div>
            <div>
              <div class="eyebrow">TOWER DOSSIER · {{ tower.attack.confidence }}</div>
              <h2>{{ tower.name }}</h2>
              <code>{{ tower.id }}</code>
              <div class="detail-family-row">
                <span v-for="family in tower.families" :key="family">{{ familyLabels[family] }}</span>
                <span v-if="tower.encyclopediaListed">百科 #{{ tower.encyclopediaOrder }}</span>
                <span>等级 {{ tower.level ?? '—' }}</span>
                <span v-if="tower.price !== null">造价 {{ tower.price }}</span>
              </div>
            </div>
          </div>

          <p class="detail-description">{{ tower.description }}</p>

          <div class="detail-stat-grid">
            <div>
              <small>单次基础伤害</small>
              <strong v-if="tower.attack.damageMin !== null">
                {{ formatNumber(tower.attack.damageMin) }}–{{ formatNumber(tower.attack.damageMax) }}
              </strong>
              <strong v-else>不可统一折算</strong>
              <span>{{ tower.attack.damageType }} · {{ tower.attack.scope }}</span>
            </div>
            <div>
              <small>{{ tower.id === 'tower_shaolin' ? '单名僧众理论 DPS' : '理论基础 DPS' }}</small>
              <strong>{{ formatNumber(tower.attack.dps) }}</strong>
              <span>未计范围目标数与技能</span>
            </div>
            <div>
              <small>攻击间隔</small>
              <strong>{{ formatNumber(tower.attack.cooldown) }}<template v-if="tower.attack.cooldown"> 秒</template></strong>
              <span>{{ tower.attack.kind }}</span>
            </div>
            <div>
              <small>{{ tower.attack.range === null ? '集结范围' : '攻击范围' }}</small>
              <strong>{{ formatNumber(tower.attack.range ?? tower.attack.rallyRange) }}</strong>
              <span>{{ tower.canBeBuffed ? '可接受标准辅助增益' : '不可接受标准辅助增益' }}</span>
            </div>
          </div>

          <TowerMechanics :key="tower.id" :tower="tower" />

          <section v-if="tower.soldier && !tower.units.length" class="detail-section">
            <div class="section-title">
              <span>驻防单位</span>
              <small>每名士兵的基础面板</small>
            </div>
            <div class="soldier-line">
              <span>人数 <b>{{ formatNumber(tower.soldier.count) }}</b></span>
              <span>生命 <b>{{ formatNumber(tower.soldier.hp) }}</b></span>
              <span>护甲 <b>{{ formatNumber(tower.soldier.armor === null ? null : tower.soldier.armor * 100) }}%</b></span>
              <span>复活 <b>{{ formatNumber(tower.soldier.respawn) }}s</b></span>
            </div>
          </section>

          <section v-if="tower.units.length" class="detail-section">
            <div class="section-title">
              <span>驻防与召唤单位</span>
              <small>{{ tower.units.length }} 种单位 · 独立战斗面板</small>
            </div>
            <div class="unit-list">
              <TowerUnitCard
                v-for="unit in tower.units"
                :key="`${tower.id}-${unit.id}`"
                :unit="unit"
                :related-skills="tower.powers.filter((power) => unit.relatedPowerIds.includes(power.id)).map((power) => power.name)"
              />
            </div>
          </section>

          <section class="detail-section">
            <div class="section-title">
              <span>定位与能力</span>
              <small>多标签，不强制互斥</small>
            </div>
            <div class="tag-row spacious">
              <span v-for="role in tower.roles" :key="role" class="role-tag">{{ role }}</span>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-title">
              <span>技能档案 · 逐级数据</span>
              <small>{{ tower.powers.length }} 项升级能力</small>
            </div>
            <div v-if="tower.powers.length" class="power-list">
              <article v-for="power in tower.powers" :key="power.id">
                <div class="power-icon" :class="{ fallback: !power.icon }" aria-hidden="true">
                  <img v-if="power.icon" :src="power.icon" alt="" />
                  <span v-else>{{ power.name.slice(0, 1) }}</span>
                </div>
                <div class="power-copy">
                  <strong>{{ power.name }}</strong>
                  <code>{{ power.id }}</code>
                </div>
                <span class="power-level">最高 {{ power.maxLevel }} 级</span>
                <div class="power-levels">
                  <section v-for="level in power.levels" :key="level.level" class="power-level-row">
                    <div class="power-level-heading">
                      <strong>{{ level.level }} 级</strong>
                      <span>{{ level.level === 1 ? '购买' : '升级' }} <b>{{ formatNumber(level.price) }}</b> 金币</span>
                      <span>累计 {{ formatNumber(level.cumulativePrice) }} 金币</span>
                    </div>
                    <p>{{ level.description }}</p>
                    <div v-if="level.parameters.length" class="power-parameters">
                      <span v-for="parameter in level.parameters" :key="parameter.label">{{ parameter.label }} <b>{{ formatNumber(parameter.value) }}{{ parameter.unit }}</b></span>
                    </div>
                    <small v-if="level.descriptionSource !== 'level' || level.unresolved" class="power-data-note">
                      {{ level.unresolved ? '部分动态数值尚未解析。' : '此级使用游戏通用说明，未推算缺失数值。' }}
                    </small>
                  </section>
                </div>
              </article>
            </div>
            <p v-else class="empty-copy">该塔没有独立技能升级。</p>
            <p v-if="tower.powers.length" class="unit-footnote">费用为该级单独花费；累计仅含本技能。数值未计科技、英雄和辅助增益。</p>
          </section>

          <section class="detail-section source-section">
            <div class="section-title">
              <span>解锁与来源</span>
              <small>字段可追溯</small>
            </div>
            <p :class="`source-unlock unlock-${tower.unlock.status}`">{{ tower.unlock.label }}</p>
            <dl>
              <div><dt>模板</dt><dd>{{ tower.sources.template || '运行时注册' }}</dd></div>
              <div><dt>中文</dt><dd>{{ tower.sources.descriptionKey || tower.sources.localization }}</dd></div>
              <div><dt>解锁</dt><dd>{{ tower.sources.unlock }}</dd></div>
              <div>
                <dt>图像</dt>
                <dd>{{ tower.encyclopediaSprite || tower.portraitSprite }}</dd>
              </div>
              <div><dt>排序</dt><dd>{{ tower.encyclopediaListed ? `游戏百科 #${tower.encyclopediaOrder}` : `基础塔后置 #${tower.encyclopediaOrder}` }}</dd></div>
            </dl>
          </section>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
