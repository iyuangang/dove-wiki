import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sourceHash } from './tower-mechanics.mjs'

const TEMPLATE = 'kr1/heroes.lua'
const SCRIPTS = 'kr1/hero_scripts.lua'
const SHARED = 'all/script_utils.lua'
const n = (value) => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null
const fmt = (value) => n(value) ?? '—'

export function mergeHeroSnapshot(previous, heroes, snapshot) {
  if (!previous?.towers) throw new Error('仅更新英雄需要已有的完整站点快照。')
  return { ...previous, metadata: { ...previous.metadata, heroSnapshot: snapshot }, summary: { ...previous.summary, heroCount: heroes.length }, heroes }
}

// Sync never renews these fingerprints. Changed scripts need another review.
export async function loadHeroReview(gameDir) {
  const review = JSON.parse(await readFile(new URL('./hero-details-review.json', import.meta.url), 'utf8'))
  const files = new Map(await Promise.all(Object.entries(review.files).map(async ([file, hash]) => {
    try {
      const text = (await readFile(join(gameDir, file), 'utf8')).replace(/\r\n/g, '\n')
      return [file, { text, valid: sourceHash(text) === hash }]
    } catch { return [file, { text: '', valid: false }] }
  })))
  return { version: review.version, files }
}

export function buildHeroDetails(raw, review) {
  const b = raw.behavior || {}
  const speed = n(b.motion?.max_speed)
  const items = []
  const pending = []
  const templateAnchor = ['hero_vesper', 'hero_muyrn', 'hero_dragon_arb'].includes(raw.id) ? `E:register_t("${raw.id}"` : `RT("${raw.id}"`
  const scriptAnchor = `scripts.${raw.id} =`
  function add(id, title, summary, facts = [], anchors = []) {
    const sources = [[TEMPLATE, templateAnchor], ...anchors].map(([file, symbol]) => {
      const source = review.files.get(file)
      const index = source?.text.indexOf(symbol) ?? -1
      return { file, symbol, line: index < 0 ? null : source.text.slice(0, index).split('\n').length, valid: Boolean(source?.valid && index >= 0) }
    })
    if (sources.some((s) => !s.valid)) { pending.push(title); return false }
    items.push({ id, title, summary, facts, sources: sources.map(({ valid, ...source }) => source) })
    return true
  }
  const own = [[SCRIPTS, scriptAnchor]]
  const rally = [...own, [SHARED, 'function SU.y_hero_new_rally(']]
  let label = b.is_flying ? '常驻飞行' : '地面移动'
  let tags = [b.is_flying ? '飞行' : '地面']
  const mobility = (value, tag) => { label = value; if (!tags.includes(tag)) tags.push(tag) }

  if (b.teleport) {
    const tp = b.teleport
    const priest = raw.id === 'hero_priest'
    const unlock = raw.template?.hero?.skills?.wingsoflight?.xp_level_steps
    const level = unlock ? Math.min(...Object.keys(unlock).map(Number)) : null
    const title = raw.id === 'hero_spider' ? '掘地转移' : priest ? '光翼传送' : '远距离传送'
    const facts = [`距离严格大于 ${fmt(tp.min_distance)} 时触发；距离不足时使用近距离移动。`, '传送过程包含出发与到达动画，不能用基础移速计算总耗时。']
    if (tp.disabled && !priest) facts.unshift('模板默认关闭此能力；启用条件尚未核实。')
    if (priest) facts.unshift(`光翼技能解锁后启用${Number.isFinite(level) ? `（英雄 Lv.${level}）` : ''}；初始模板不具备传送能力。`)
    if (tp.delay > 0) facts.push(`额外隐藏等待 ${fmt(tp.delay)} 秒，不含动画时间。`)
    if (raw.id === 'hero_spider') facts.push(`随后还有 ${fmt(tp.duration)} 秒接近阶段；到达后的掘地攻击须技能已启用。`)
    if (raw.id === 'hero_10yr') facts.push('巨人形态期间关闭传送；调动距离大于 200 时会先结束巨人形态，恢复传送，并按剩余变身时间补偿冷却。')
    if (priest) facts.push('出发点与到达点均调用光翼增益逻辑。')
    if (add('teleport', title, '改变集结点时，依据当前位置与目标点的直线距离判断是否传送。', facts, [...rally, [SHARED, 'function SU.hero_will_teleport(']])) {
      if (!tp.disabled || priest) mobility(priest ? '步行 / 技能传送' : raw.id === 'hero_spider' ? '步行 / 掘地转移' : '步行 / 传送', '传送')
    }
  }
  if (b.transfer && !b.transfer.disabled) {
    const tr = b.transfer
    const names = { hero_alric: '沙化移动', hero_durax: '棱晶移动', hero_space_elf: '近距离形态移动' }
    if (add('transfer', names[raw.id] || '变形移动', `调动距离大于 ${fmt(tr.min_distance)} 时使用移动形态。`, [
      `基础移速增加 ${fmt(tr.extra_speed)}，无外部增益时为 ${fmt(speed + tr.extra_speed)}。`,
      '移动形态期间忽略伤害，到达后恢复原移速。',
      ...(b.teleport ? ['达到传送阈值时优先使用传送。'] : []),
    ], rally) && !b.teleport) mobility(names[raw.id] || '变形移动', '变形加速')
  }
  const forms = {
    hero_hunter: ['flywalk', '迷雾移动'], hero_robot: ['flywalk', '喷气飞行'],
    hero_wukong: ['flywalk', '腾云移动'], hero_muyrn: ['treewalk', '树行移动'],
    hero_venom: ['slimewalk', '黏液移动'], hero_margosa: ['treewalk', '蝙蝠移动'],
    hero_monkey_god: ['cloudwalk', '腾云移动'],
  }
  const form = forms[raw.id]
  if (form && b[form[0]]) {
    const [key, title] = form
    const tr = b[key]
    const multiplier = tr.extra_speed_mult ?? tr.speed_factor
    const formSpeed = multiplier != null ? speed * multiplier : speed + tr.extra_speed
    const facts = [
      `直线距离大于 ${fmt(tr.min_distance)}，或已生成的路径点含水面、浅水、不可步行地形时触发。`,
      multiplier != null ? `移速乘以 ${fmt(multiplier)}，无外部增益时为 ${fmt(formSpeed)}。` : `移速增加 ${fmt(tr.extra_speed)}，无外部增益时为 ${fmt(formSpeed)}。`,
      '特殊移动结束后恢复原移速；可经过的地形与可选集结点分别受寻路规则限制。',
    ]
    if (raw.id === 'hero_venom') facts.push('已处于战斗变身状态时，不进入黏液赶路形态。')
    if (raw.id === 'hero_margosa') facts.push('强化状态期间不进入蝙蝠赶路形态。')
    if (add('travel-form', title, '普通战斗状态与赶路形态分开处理；赶路飞行不代表常驻飞行单位。', facts, own)) mobility(`地面 / ${title}`, '变形加速')
  }
  if (raw.id === 'hero_vampiress' && b.fly_to) {
    if (add('bat-flight', '蝙蝠赶路', `调动距离大于 ${fmt(b.fly_to.min_distance)} 时变成蝙蝠。`, [
      `移速从 ${fmt(speed)} 切换为 ${fmt(b.motion.max_speed_bat)}；到达后恢复。`, '变形赶路时忽略伤害；正常作战仍按地面英雄处理。',
    ], rally)) mobility('地面 / 蝙蝠飞行', '变形加速')
  }
  if (raw.id === 'hero_crab' && b.burrow) {
    const unlocks = raw.template?.hero?.skills?.burrow?.xp_level_steps || {}
    const first = Math.min(...Object.keys(unlocks).map(Number))
    if (add('burrow', '技能潜地', `潜地技能解锁后，调动距离大于 ${fmt(b.burrow.min_distance)} 时入地赶路。`, [
      ...(Number.isFinite(first) ? [`英雄 Lv.${first} 首次解锁；未解锁时步行。`] : []),
      `入地时增加 ${fmt(b.burrow.init_accel)} 基础移速，随后还会按技能等级加速。`,
      '解锁后可经过水面和浅水；目标集结点仍使用独立的地面限制。',
    ], own)) mobility('步行 / 技能潜地', '潜地')
  }
  if (raw.id === 'hero_xin') {
    if (add('xin-rally', '调动即传送', '每次处理新的集结点，都在出发动画结束后直接移动到目标点。', [
      '这段调动逻辑没有最短距离阈值。',
      '如果出发时正在阻挡敌人，会眩晕被阻挡目标，并生成短暂替身接替阻挡；本体到达后替身死亡。',
    ], own)) mobility('集结点传送', '传送')
  }
  if (raw.id === 'hero_raelyn') {
    if (add('raelyn-jump', '按横向距离跳跃', '目标点与当前位置的横向距离大于 125 且小于 300 时，调动改为跳跃。', [
      '检查的是横向距离绝对值，不是直线距离；恰好 125 或 300 时不触发。',
      '其余距离走通用移动逻辑；跳跃耗时受动作帧率影响。',
    ], own)) mobility('步行 / 条件跳跃', '跳跃')
  }
  if (raw.id === 'hero_tramin') {
    if (add('tramin-jetpack', '长距离火箭跳', `调动距离小于 ${fmt(b.max_dist_walk)} 时奔跑，否则使用喷气背包跳跃。`, [
      '距离按集结中心与角色站位偏移校正后计算。',
      `抛物线飞行阶段为 ${fmt(b.flight_time)} 秒，不含起跳与落地动画。`,
      '起跳时清除饮酒效果。',
    ], own)) mobility('奔跑 / 火箭跳', '跳跃')
  }
  if (b.is_flying) add('flying', '常驻飞行单位', '模板带有飞行目标标记，普通攻击采用空中英雄逻辑。', [
    b.nav_grid?.ignore_waypoints ? '基础导航忽略地面路径拐点，直接向目的地移动。' : '使用英雄自身的导航配置。',
    '仍受本英雄的目的地地形限制；“飞行”不表示所有地图位置都可选。',
  ], own)
  if (label === '地面移动') add('ground-navigation', '地面寻路', '默认以地面单位的导航配置处理调动。', [
    b.nav_grid?.ignore_waypoints ? '基础导航配置忽略中间路径点。' : '基础导航沿生成的路径点前进，实际路程可能长于两点直线距离。',
    '途中可经过的地形与可选集结点分别限制。',
  ], rally)
  if (raw.id === 'hero_dragon_arb') add('flight-easing', '飞行加速与减速', '调动飞行有起步加速和接近目的地时的减速，实际行程并非恒速。', [
    '起步加速参数为 0.7 秒；距离目的地 50 以内切换为接近减速。',
    '同方向连续改点会衔接上一段速度变化，不能简单按距离除以基础移速推算。',
  ], own)
  if (raw.id === 'hero_gerald') add('boss-dodge', '对首领的格挡限制', '首领来源的攻击，在通常的格挡判定外还有一次额外检查。', [
    `额外检查通过概率为 ${fmt(b.dodge.low_chance_factor * 100)}%；这不是最终格挡率，仍要结合技能提供的格挡概率。`,
  ], own)

  if (raw.id === 'hero_bolverk') add('berserker', '残血缩短攻击冷却', '生命比例越低，普通近战、第二近战招式与第一项定时技能的冷却越短。', [
    `冷却倍率 = 生命比例 × ${fmt(1 - b.berserker_factor)} + ${fmt(b.berserker_factor)}。`,
    `满血为 1 倍冷却，半血为 ${fmt(0.5 * (1 - b.berserker_factor) + b.berserker_factor)} 倍，濒死趋近 ${fmt(b.berserker_factor)} 倍。`,
    '只改变上述攻击冷却，不代表伤害翻倍或所有技能都获得相同加速。',
  ], own)
  if (raw.id === 'hero_oni') add('oni-missing-health', '失血增伤与减伤', '按当前已损失生命比例，动态增加伤害加值并降低受伤倍率。', [
    '伤害加值 = 已损失生命比例 × 当前技能的狂怒上限；受伤倍率减量 = 已损失生命比例 × 当前技能的不屈上限。',
    '以当前血量持续重算；回血后这两项收益会随之降低。',
  ], own)
  if (raw.id === 'hero_wilbur') {
    const skill = raw.template?.hero?.skills?.engine
    add('engine-speed', '引擎影响飞行速度', '升级时以基础引擎速度乘以当前引擎技能倍率，重新设置飞行速度。', [
      `引擎基准速度 ${fmt(b.motion.max_speed_base)}；技能倍率依次为 ${Object.values(skill?.speed_factor || {}).map(fmt).join(' / ')}。`,
      '倍率覆盖当前引擎系数，不是每升一级继续相乘。',
    ], own)
  }
  if (raw.id === 'hero_mirage') add('swiftness', '迅捷同时改变移动与动作', '迅捷升级会提高自身移速和近战接敌距离，并调整角色动作帧率。', [
    `各次技能升级的移速倍率为 ${Object.values(raw.template?.hero?.skills?.swiftness?.max_speed_factor || {}).map(fmt).join(' / ')}，按升级触发顺序乘入当前数值。`,
    '因此模板基础移速不代表满级实际移速，攻击动作耗时也不能只看冷却字段。',
  ], own)
  if (['hero_alleria', 'hero_beastmaster'].includes(raw.id)) add('pet-rally', '调动时带领宠物', raw.id === 'hero_alleria'
    ? '更改集结点时，会为已召唤的野猫一同设置新的目标位置。'
    : '更改集结点时，会围绕目标位置重新分配已召唤野猪的站位。', [
    '只作用于已经存在的宠物；调动指令本身不会额外召唤宠物。',
  ], own)
  if (raw.id === 'hero_dragon_gem' && b.passive_charge) add('travel-charge', '移动触发蓄能', `一次调动完成后，实际起终点距离大于 ${fmt(b.passive_charge.distance_to_charge)} 时施加蓄能效果。`, [
    '检查的是本次起终点距离，不是沿途累计路程；短距离反复移动不会直接累加到阈值。',
  ], own)
  if (raw.id === 'hero_xin') add('xin-cleanse', '驭体于灵状态清除异常', '驭体于灵状态激活时，每隔约 10 帧检查并移除带毒、眩晕或流血标记的效果。', [
    '该检查位于未眩晕的行为分支；不能据此视为永久眩晕免疫。',
  ], own)

  // Attack entries are template parameters, not a simulated full-level DPS.
  const attacks = []
  for (const [kind, attack, range] of [
    ['近战', b.melee?.attacks?.[0], b.melee?.range],
    ['远程', b.ranged?.attacks?.[0], b.ranged?.attacks?.[0]?.max_range],
  ]) {
    if (attack) attacks.push({ kind, cooldown: n(attack.cooldown), range: n(range), minRange: n(attack.min_range), disabled: Boolean(attack.disabled) })
  }
  const terrain = b.nav_grid || {}
  const terrainLabels = (mask) => [[1, '陆地'], [2, '水面'], [4, '悬崖'], [256, '不可步行区域'], [512, '浅水'], [1024, '精灵地形'], [2048, '冰面']].filter(([flag]) => (mask & flag) !== 0).map(([, name]) => name)
  const baseSources = [{ file: TEMPLATE, symbol: templateAnchor, line: null }]
  const base = review.files.get(TEMPLATE)
  const baseIndex = base?.text.indexOf(templateAnchor) ?? -1
  if (baseIndex >= 0) baseSources[0].line = base.text.slice(0, baseIndex).split('\n').length
  if (pending.length) { label = '移动机制待核实'; tags = [] }
  return {
    reviewedVersion: review.version, movement: { label, tags, baseSpeed: speed, terrain: terrainLabels(terrain.valid_terrains), destinations: terrainLabels(terrain.valid_terrains_dest) },
    respawnSeconds: n(b.health?.dead_lifetime), regenInterval: n(b.regen?.cooldown), regenHitDelay: n(b.regen?.last_hit_standoff_time),
    attacks, items, pending, sources: baseSources,
  }
}
