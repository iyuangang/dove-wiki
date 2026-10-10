import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sourceHash } from './tower-mechanics.mjs'

const baseSupportEffects = [
  {
    id: 'crossbow-eagle',
    sourceType: 'tower',
    sourceTowerId: 'tower_crossbow',
    skillId: 'eagle',
    name: '驯鹰者',
    mode: 'aura',
    levels: [
      { level: 1, radius: 170, rangeBonus: 0.05, speedBonus: 0.15 },
      { level: 2, radius: 210, rangeBonus: 0.075, speedBonus: 0.2 },
      { level: 3, radius: 250, rangeBonus: 0.1, speedBonus: 0.25 },
    ],
    note: '范围倍率与其他增距来源相乘；攻速加成加入攻速除数。',
  },
  {
    id: 'pirate-watcher',
    sourceType: 'tower',
    sourceTowerId: 'tower_pirate_watchtower',
    skillId: 'watcher',
    name: '眺望',
    mode: 'aura',
    levels: [
      { level: 1, radius: 250, rangeBonus: 0.1 },
      { level: 2, radius: 250, rangeBonus: 0.2 },
      { level: 3, radius: 250, rangeBonus: 0.3 },
    ],
    note: '只改变攻击范围；对兵营塔显示为集结范围。',
  },
  {
    id: 'high-elven-sentinel',
    sourceType: 'tower',
    sourceTowerId: 'tower_high_elven',
    skillId: 'sentinel',
    name: '元素赐福',
    mode: 'aura',
    levels: [
      { level: 1, radius: 180, damageBonus: 0.135, speedBonus: 0.09 },
      { level: 2, radius: 240, damageBonus: 0.18, speedBonus: 0.12 },
      { level: 3, radius: 300, damageBonus: 0.225, speedBonus: 0.15 },
    ],
    note: '伤害百分比与其他增伤来源相加。',
  },
  {
    id: 'arcane-empowerment',
    sourceType: 'tower',
    sourceTowerId: 'tower_arcane_wizard_lvl4',
    skillId: 'empowerment',
    name: '强化光环',
    mode: 'aura',
    levels: [
      { level: 1, radius: 240, damageBonus: 0.15 },
      { level: 2, radius: 240, damageBonus: 0.25 },
      { level: 3, radius: 240, damageBonus: 0.4 },
    ],
    note: '同种强化光环取有效最高等级。',
  },
  {
    id: 'furnace-heat',
    sourceType: 'tower',
    sourceTowerId: 'tower_melting_furnace',
    skillId: 'heat',
    name: '摩擦生热',
    mode: 'aura',
    levels: [
      { level: 1, radius: 291.5, damageBonus: 0.15 },
      { level: 2, radius: 291.5, damageBonus: 0.3 },
    ],
    note: '常驻增伤光环。',
  },
  {
    id: 'furnace-fuel',
    sourceType: 'tower',
    sourceTowerId: 'tower_melting_furnace',
    skillId: 'fuel',
    name: '燃料爆燃',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 291.5, speedBonus: 0.5, duration: 10, cycle: 30 },
    ],
    note: '每 30 秒触发、持续 10 秒；结果显示生效期间的峰值。',
  },
  {
    id: 'dark-elf-hunt',
    sourceType: 'tower',
    sourceTowerId: 'tower_dark_elf_lvl4',
    skillId: 'skill_buff',
    excludeTowerIds: ['tower_dark_elf_lvl4'],
    name: '猎杀戾气',
    mode: 'triggered',
    levels: [
      { level: 1, radius: 225, damagePerTrigger: 0.008, triggerCap: 20 },
      { level: 2, radius: 225, damagePerTrigger: 0.008, triggerCap: 50 },
      { level: 3, radius: 225, damagePerTrigger: 0.008, triggerCap: 9999999 },
    ],
    note: '标记目标死亡后，灵魂随机传给 225 范围内另一座塔；无其他塔时回到自身。这里只计算其他塔每次 0.8% 的当前增伤，不包括暮光长弓自身的固定伤害与攻速成长；升级后源码另按每次 8% 重放增伤。',
  },
  {
    id: 'denas-resource-management',
    sourceType: 'hero',
    sourceHeroId: 'hero_denas',
    skillId: 'resource_management',
    name: '资源调配',
    mode: 'passive',
    requiresBuffable: false,
    levels: [{ level: 1, radius: 0, priceMultiplier: 0.95 }],
    note: '迪纳斯登场时将所有塔模板价格乘以 0.95 并向下取整；不受 tower.can_be_mod 限制。',
  },
  {
    id: 'denas-tower-buff',
    sourceType: 'hero',
    sourceHeroId: 'hero_denas',
    skillId: 'tower_buff',
    name: '皇家号令',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 200, rangeBonus: 0.25, speedBonus: 0.25, duration: 5, cycle: 11.7 },
      { level: 2, radius: 200, rangeBonus: 0.25, speedBonus: 0.25, duration: 8, cycle: 11.7 },
      { level: 3, radius: 200, rangeBonus: 0.25, speedBonus: 0.25, duration: 11, cycle: 11.7 },
    ],
    note: '范围乘以 1.25；模板冷却系数 0.75 经共享函数转换为攻速除数 +0.25，与其他攻速增益相加。显示技能生效期间的峰值。',
  },
  {
    id: 'priest-consecrate',
    sourceType: 'hero',
    sourceHeroId: 'hero_priest',
    skillId: 'consecrate',
    name: '神圣祝颂',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 160, damageBonus: 0.18, duration: 8, cycle: 8 },
      { level: 2, radius: 160, damageBonus: 0.24, duration: 15, cycle: 8 },
      { level: 3, radius: 160, damageBonus: 0.3, duration: 22, cycle: 8 },
    ],
    note: '每次选择范围内最近的一座未祝颂塔；伤害加成同时传递给兵营士兵。',
  },
  {
    id: 'minotaur-roar-of-fury',
    sourceType: 'hero',
    sourceHeroId: 'hero_minotaur',
    skillId: 'roaroffury',
    name: '野牛怒吼',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 0, damageBonus: 0.25, duration: 4, cycle: 15 },
      { level: 2, radius: 0, damageBonus: 0.5, duration: 4, cycle: 15 },
      { level: 3, radius: 0, damageBonus: 0.75, duration: 4, cycle: 15 },
    ],
    note: '对全场所有可被强化且未封锁的塔生效，显示 4 秒持续期内的峰值。',
  },
  {
    id: 'phoenix-flaming-path',
    sourceType: 'hero',
    sourceHeroId: 'hero_phoenix',
    skillId: 'flaming_path',
    name: '余烬之地',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 125, flatDps: 15, duration: 6.5, cycle: 30 },
      { level: 2, radius: 125, flatDps: 30, duration: 6.5, cycle: 30 },
      { level: 3, radius: 125, flatDps: 45, duration: 6.5, cycle: 30 },
    ],
    note: '附着到附近一座塔，每 2 秒造成 30/60/90 点范围真实伤害；额外 DPS 按持续期峰值计入。',
  },
  {
    id: 'space-elf-spatial-distortion',
    sourceType: 'hero',
    sourceHeroId: 'hero_space_elf',
    skillId: 'spatial_distortion',
    name: '空间扭曲',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 0, damageBonus: 0.04, rangeBonus: 0.04, speedBonus: 0.04, duration: 6, cycle: 25 },
      { level: 2, radius: 0, damageBonus: 0.06, rangeBonus: 0.06, speedBonus: 0.06, duration: 7, cycle: 23 },
      { level: 3, radius: 0, damageBonus: 0.08, rangeBonus: 0.08, speedBonus: 0.08, duration: 8, cycle: 20 },
    ],
    note: '对全场所有可强化塔同时生效；模板冷却系数经共享函数转换为攻速除数 +0.04/+0.06/+0.08，与其他攻速增益相加。',
  },
  {
    id: 'lava-hotheaded',
    sourceType: 'hero',
    sourceHeroId: 'hero_lava',
    skillId: 'hotheaded',
    name: '烈焰之心',
    mode: 'triggered',
    levels: [
      { level: 1, radius: 180, damageBonus: 0.2, duration: 6 },
      { level: 2, radius: 180, damageBonus: 0.3, duration: 6 },
      { level: 3, radius: 180, damageBonus: 0.4, duration: 6 },
    ],
    note: '喀拉托复活时强化周围塔 6 秒；结果显示触发后的峰值。',
  },
  {
    id: 'oloch-hellish-infusion',
    sourceType: 'hero',
    sourceHeroId: 'hero_oloch',
    skillId: 'hellish_infusion',
    name: '地狱注入',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 170, damageBonus: 0.1, duration: 6, cycle: 18 },
      { level: 2, radius: 170, damageBonus: 0.2, duration: 6, cycle: 18 },
      { level: 3, radius: 170, damageBonus: 0.3, duration: 6, cycle: 18 },
    ],
    note: '强化椭圆范围内全部可强化塔；显示 6 秒持续期内的峰值。',
  },
]

const towerSources = {
  tower_crossbow: ['kr1/archer_towers.lua', 'kr1/game_scripts.lua'],
  tower_pirate_watchtower: ['kr1/archer_towers.lua', 'kr1/game_scripts.lua'],
  tower_high_elven: ['kr1/mage_towers.lua', 'kr1/game_scripts.lua'],
  tower_arcane_wizard_lvl4: ['kr1/mage_towers.lua'],
  tower_melting_furnace: ['kr1/engineer_towers.lua'],
  tower_dark_elf_lvl4: ['kr1/archer_towers.lua'],
  tower_archers: ['kr1/archer_towers.lua'],
  tower_wizard: ['kr1/mage_towers.lua'],
}
const commonSources = ['kr1/tower_scripts.lua', 'all/templates.lua', 'all/scripts.lua', 'all/script_utils.lua', 'all/systems/mod_lifecycle.lua']

// Maintained after reading the installed source; sync only checks these hashes.
export async function loadSupportReview(gameDir, reviewUrl = new URL('./support-effects-review.json', import.meta.url)) {
  const manifest = JSON.parse(await readFile(reviewUrl, 'utf8'))
  const invalidFiles = []
  const hashes = await Promise.all(Object.entries(manifest.files).map(async ([file, hash]) => {
    try { return [file, sourceHash(await readFile(join(gameDir, file), 'utf8')) === hash] }
    catch { return [file, false] }
  }))
  for (const [file, valid] of hashes) if (!valid) invalidFiles.push(file)
  return { manifest: { ...manifest, invalidFiles } }
}

export function buildSupportEffects(raw, review) {
  const towers = new Map(raw.towers.map((tower) => [tower.id, tower]))
  const effects = structuredClone(baseSupportEffects)
  const archers = towers.get('tower_archers')?.template
  if (archers) effects.splice(2, 0, {
    id: 'archers-eye', sourceType: 'tower', sourceTowerId: 'tower_archers',
    skillId: 'skill_b', name: '苍穹之眼', mode: 'aura', radiusUsesSourceRange: true,
    rangeFalloff: { edgeFactor: 0.5 },
    levels: archers.powers.skill_b.range_factor.map((factor, index) => ({
      level: index + 1, radius: archers.attacks.range, rangeBonus: Number((factor - 1).toFixed(12)),
    })),
    note: '覆盖范围随源塔当前攻击范围变化。增距 = 中心加成 × (1 − 距离/半径 ÷ 2)，边缘仅一半；按游戏椭圆距离计算。同类只保留实际倍率最高者。结果按当前位置首次获得光环计算；移动后较弱倍率不会自动替换旧倍率。',
  })
  const wizard = towers.get('tower_wizard')?.template
  if (wizard) {
    const attack = wizard.attacks.list[2]
    effects.splice(effects.findIndex((effect) => effect.id === 'furnace-heat'), 0, {
      id: 'wizard-knowledge', sourceType: 'tower', sourceTowerId: 'tower_wizard',
      skillId: 'skill_b', name: '知识之卷', mode: 'temporary', radiusUsesSourceRange: true,
      levels: attack.damage_factor.map((factor, index) => ({
        level: index + 1, radius: wizard.attacks.range, damageBonus: factor - 1,
        duration: attack.duration[index], cycle: attack.cooldown,
      })),
      note: '源塔攻击范围内有敌人时才释放，强化范围内通过可强化、未封锁与可见性检查的塔，包含自身；覆盖半径随源塔增距变化。同类高等级替换低等级，同级刷新持续时间；与其他增伤百分比相加，结果为持续期峰值。25 秒为基础冷却，会受源塔攻速增益影响。',
    })
  }
  return effects.filter((effect) => effect.sourceType !== 'tower' || towers.has(effect.sourceTowerId)).map((effect) => {
    const attack = effect.id === 'wizard-knowledge' ? wizard.attacks.list[2]
      : effect.id === 'arcane-empowerment' ? towers.get('tower_arcane_wizard_lvl4')?.template.attacks.list[2]
      : effect.id === 'archers-eye' ? archers.attacks.list?.[2] : null
    if (attack) effect.excludeTowerIds = raw.towers.filter((tower) =>
      ((tower.template?.vis?.flags || 0) & (attack.vis_bans || 0)) !== 0 || ((tower.template?.vis?.bans || 0) & (attack.vis_flags || 0)) !== 0,
    ).map((tower) => tower.id)
    let sources
    if (effect.sourceType === 'tower') sources = [...(towerSources[effect.sourceTowerId] || []), ...commonSources]
    else if (['denas-tower-buff', 'space-elf-spatial-distortion'].includes(effect.id)) sources = ['kr1/heroes.lua', 'kr1/hero_scripts.lua', ...commonSources.slice(1)]
    if (!sources) return effect
    const invalidFiles = sources.filter((file) => !review.manifest.files[file] || review.manifest.invalidFiles.includes(file))
    return { ...effect, review: { reviewedVersion: review.manifest.version, sources, valid: invalidFiles.length === 0, invalidFiles } }
  })
}

