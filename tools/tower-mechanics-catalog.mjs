// Human-reviewed behavior, read from the local Dove scripts. Text must describe
// the actual branch conditions, not infer behavior from a template/skill name.
const TS = 'kr1/tower_scripts.lua'
const AS = 'all/scripts.lua'
const source = (file, anchor) => [file, anchor]
const tpl = (file) => source(`kr1/${file}_towers.lua`, 'register_t')
const num = (n) => Number(n.toFixed(3))
const attack = (t) => t.template.attacks.list[0]
const ref = (t, id) => t.references[id]
const entry = (id, title, sources, build, kind = 'intrinsic') => ({ id, title, sources, build, kind })
const text = (summary, ...details) => () => ({ summary, details })
const sharedArmorSources = [source('all/systems/health.lua', 'elseif band(d.damage_type, DAMAGE_MAGICAL_ARMOR)'), source('all/script_utils.lua', 'function SU.magic_armor_inc')]

export const mechanicCatalog = {
  tower_tesla: [entry('tesla-chain', '连锁数量、伤害倍率与重复目标', [tpl('engineer'), source('kr1/game_scripts.lua', 'function scripts.ray_tesla.update')], text('基础电弧可额外跳跃 2 次，即无特殊中继时最多触及 3 个不同目标；连锁技能每级再增加一次跳跃，满级最多 6 个目标。', '未计科技时，伤害计算使用 0.5 倍系数，后续跳跃保持这一倍率，不会每次再减半。工程效率科技会将该系数改为 1。', '连锁基础搜索距离 95，技能每级增加 5；同一条链共享已命中名单，不会反复电击同一个目标。附近目标不足时不会强行产生完整跳跃次数。', '雷神可以作为特殊中继并被治疗，且会修改连锁范围与次数；上述目标上限针对没有这种特殊中继的情况。'))],
  tower_frankenstein: [entry('frankenstein-chain', '连锁逐段衰减，也能治疗傀儡', [tpl('engineer'), source('kr1/game_scripts.lua', 'function scripts.ray_frankenstein.update')], text('无工程效率科技时，初次电击、第一次跳跃、第二次及之后跳跃的倍率为 100% / 75% / 50%；下限 50%。', '基础额外跳跃 2 次，闪电技能每级增加一次；同一条链不重复命中已经访问的单位。工程效率科技会让后续跳跃使用 100% 倍率。', '跳跃时先找可用雷神，再找最近的未命中敌人，最后才找弗兰奇。命中弗兰奇时恢复 10 点生命，不对它造成普通电击伤害。', '雷神中继有额外范围与次数规则，不能套用没有英雄中继时的普通目标上限。'))],
  tower_sparking_geode_lvl4: [entry('geode-low-count', '敌人较少时增伤，连续出手逐渐加速', [tpl('engineer'), source(TS, 'function scripts.tower_sparking_geode.update')], (t) => ({ summary: '发射时按当前候选敌人数调整倍率：1 / 2 / 3 / 至少 4 个敌人时，分别为 200% / 166.67% / 133.33% / 100%。', details: [`基础持续攻击分支的发射等待从接近 ${attack(t).ray_timing_max} 秒逐渐缩短至 ${attack(t).ray_timing_min} 秒，按本轮出手序号计算；没有攻速增益时第 ${t.template.attacks.attack_count_for_min_cooldown} 发达到最短等待。`, '前述等待不是整轮攻击的统一冷却；进入/退出动作、技能打断、目标离场和冷却增益都会影响实战节奏。'], formula: '少目标增伤倍率 = max(1, 1 + (4 − N) / 3)' }))],
  tower_assassin: [
    entry('assassin-survive', '刺客自带保命，不需要先买闪避技能', [source(TS, 'function scripts.soldier_assassin.on_damage'), tpl('barrack'), source('all/systems/health.lua', 'h.on_damage')], text('刺客受到足以致死的伤害时，若保命计时已就绪，会取消本次伤害并将生命设为 1。这个分支没有技能等级条件。', '两次触发之间必须严格超过 20 秒；初始计时为 0，所以不是刚生成就必定能触发。检查使用游戏时间。', '伤害类型恰好等于吞噬（DAMAGE_EAT）时直接跳过保命。此规则不等于对所有秒杀、脚本移除或特殊处决都免疫。')),
    entry('assassin-dodge', '特殊攻击的闪避概率会打折', [tpl('barrack'), source('all/script_utils.lua', 'function SU.unit_dodges')], text('刺客模板允许闪避远程攻击；通用闪避流程把远程攻击或范围攻击归为特殊攻击，使用当前闪避率的 60% 判定。', '例如当前闪避率 50%，对应特殊攻击判定为 30%，不是同样的 50%。', '眩晕中不能闪避，带“不可闪避”伤害标记的攻击也不参与普通闪避判定；当前闪避率还受技能升级影响。')),
  ],
  tower_barrack_amazonas: [entry('amazona-intrinsic', '女战士的毒免与击杀恢复', [tpl('barrack'), source(AS, 'scripts.mod_heal_on_kill =')], text('女战士模板自带中毒效果禁用标记；基础击杀跟踪效果为恢复 60 点生命。', '“免疫中毒效果”与所有伤害来源都无法伤害她不同；其他伤害类型仍正常结算。', '升级 valkyrie 后，击杀跟踪会换成另一个成长效果，不能继续只按基础恢复效果理解。'))],
  tower_baby_ashbite: [entry('ashbite-flight', '龙巢幼龙是飞行单位', [tpl('barrack')], text('幼龙带飞行标记，并禁止吞噬、网、中毒和燃烧效果。', '它的攻击由远程技能执行，不能套用普通地面兵营士兵的近战阻挡方式；上方缺少统一普攻 DPS 不代表它没有攻击能力。', '这些是模板的目标筛选标记；特定敌人的直接脚本效果仍需单独检查，不能概括成完全无敌。'))],
  tower_shaolin: [
    entry('shaolin-distribution', '僧众分摊目标与集中攻击衰减', [source(TS, 'scripts.tower_shaolin ='), source(TS, 'scripts.decal_shaolin ='), tpl('archer')], (t) => ({
      summary: `普攻由 ${t.template.powers.total.base_count} 名僧众共同出击；人多势众每级增加 1 名，满级 6 名。僧众按候选敌人列表循环分配目标。`,
      details: ['同一轮落在同一目标上的前三击均为全额；第四、五、六击分别约为 70.71%、57.74%、50%。衰减在每轮分配目标时重新计算，不会跨轮累计。', '敌人越少，单个敌人分到的攻击越多；两名目标、六名僧众时各承受三击，均不衰减。候选目标数可能包含尚未被分配到攻击的敌人。', '这属于多名僧众分头攻击，不是单次命中后对周围造成溅射。上方基础伤害与 DPS 只代表一名僧众，整轮伤害见下方计算。'],
      formula: '第 i 名僧众：r = ceil(i / 目标数)，倍率 = 1 / √max(r − 2, 1)',
    })),
    entry('shaolin-control', '普攻自带控制：条件与实际时长', [source(TS, 'scripts.decal_shaolin ='), source(TS, 'scripts.tower_shaolin ='), source('kr1/data/game_animations.lua', 'shaolin_monk_lvl4_punchIn ='), source('all/animation_db.lua', 'function animation_db:fn('), source('all/utils.lua', 'function U.y_animation_wait_default'), source('all/constants.lua', 'FPS = 30')], text(
      '僧众出手前增加目标的眩晕计数，动作结束后解除；必须是可眩晕、非 Boss、且当前没有士兵阻挡的敌人。',
      '地面拳/踢动作均为 9 帧入场 + 8 帧退场，按默认 30 帧/秒估算，单名僧众约控制 0.567 秒。控制从出手开始，伤害在等待 6 帧后结算。',
      '同一目标的后续僧众每次错开 2 帧。无攻速增益、三名僧众围攻一个地面敌人时，重叠控制窗口约 (17 + 2×2) / 30 = 0.7 秒；六名时约 0.9 秒。这是动画推算值，并非固定 0.7 秒的状态效果。',
      '飞行目标走另一套动作：6 帧等待 + 5 帧等待 + 8 帧退场，单名约 0.633 秒。攻速、帧调度、目标死亡或防御塔移除会改变实际控制窗口；Boss 虽走该动作分支，仍不会被眩晕。',
    )),
    entry('shaolin-gold', '丰饶之狮在进范围时标记金币', [source(TS, 'scripts.aura_tower_shaolin_gold ='), tpl('archer')], text(
      '购买丰饶之狮后，光环扫描范围内敌人并直接提高其金币值；同一个光环对同一个敌人只处理一次。',
      '实际计数累加的是标记时增加的金币值，不是等待击杀后实际收到的金币。只有累计值严格大于 200 后，后续目标才改用 5%；等于 200 时仍用 12%。两档均向上取整。',
      '标记不会因走出范围而撤回；不同少林寺使用各自的光环编号，因此可以分别标记同一敌人。这与简短技能描述的“在范围内死亡、赚取后下降”存在口径差异。',
    ), 'skill-interaction'),
  ],
  tower_wild_magus: [entry('wild-repeat', '连续攻击会递减伤害，但有目标条件', [source(TS, 'scripts.tower_wild_magus ='), tpl('mage')], (t) => {
    const b = ref(t, attack(t).bullet).bullet
    return { summary: `对同一名 can_do_magic 为真的敌人持续射击，从第二发起每发多扣 ${b.damage_same_target_inc} 点基础伤害，最多扣 ${b.damage_same_target_max} 点。`, details: [`基础 ${b.damage_min}–${b.damage_max} 最终可降至 ${b.damage_min - b.damage_same_target_max}–${b.damage_max - b.damage_same_target_max}。这是减固定伤害，不是乘百分比。`, '更换目标会重置计数；目标 can_do_magic 为假时也重置。仅停火但未更换目标，脚本没有设置按时间自动清空的分支。', 'can_do_magic 是游戏的施法能力状态字段，不能等同于敌人的魔抗数值。'], formula: `第 n 发扣减 = min(${b.damage_same_target_max}, (n − 1) × ${b.damage_same_target_inc})` }
  })],
  tower_silver: [entry('silver-distance', '远近两套普攻与真伤暴击', [source(TS, 'scripts.tower_silver ='), tpl('archer')], (t) => {
    const a = t.template.attacks, b = attack(t)
    return { summary: `以 ${a.short_range} 为远近分界，超过才使用远程模式。远近攻击的伤害、间隔和暴击率均不同。`, details: b.bullets.map((id, i) => `${i ? '远程' : '近程'}：${ref(t,id).bullet.damage_min}–${ref(t,id).bullet.damage_max} 伤害，间隔 ${b.cooldowns[i]} 秒，暴击率 ${num(a.critical_chances[i]*100)}%。`).concat('暴击将本次伤害翻倍，并把伤害类型改为真实伤害；这不是所有普攻都无视护甲。距离由塔攻击原点到敌人位置的直线距离判断。') }
  })],
  tower_crossbow: [entry('crossbow-crit', '鹰眼解锁的暴击也作用于连射', [source(TS, 'scripts.tower_crossbow ='), tpl('archer')], (t) => ({ summary: '未购买鹰眼时，这条暴击分支不生效；购买后，普通攻击和连射弹丸均逐发判定双倍伤害。', details: [`鹰眼 1 / 2 / 3 级暴击率为 ${[1,2,3].map(l=>num((attack(t).critical_chance+l*attack(t).critical_chance_inc)*100)).join(' / ')}%。`, '该机制只放大伤害倍率，脚本不会像黄金长弓那样把暴击改为真实伤害。'] }), 'skill-interaction')],
  tower_arcane: [entry('arcane-shred', '普攻逐次削减魔抗', [tpl('archer'), source(AS, 'function scripts.mod_damage.insert'), ...sharedArmorSources], (t) => ({ summary: `箭矢附带独立的削魔抗效果，每次命中减少 ${num(ref(t,'mod_arrow_arcane').damage_min*100)} 个百分点的魔法护甲。`, details: ['这是对目标属性的削减，不是只让本次攻击穿透魔抗；效果没有配置自动到期恢复。', '实际削减乘以 (1 − 目标护甲韧性)，并受目标免疫、伤害处理与护甲下限规则约束。', '普攻本身是混合伤害，其护甲算法见本栏的伤害结算规则。'] }))],
  tower_archmage: [
    entry('archmage-storage', '储弹与概率多发', [source(TS, 'scripts.tower_archmage ='), tpl('mage')], (t) => ({ summary: `空闲时可准备并储存最多 ${attack(t).max_stored_bullets} 枚魔法弹；有目标时释放存弹。`, details: [`正常有目标、没有存弹的准备流程至少生成一枚，其余 ${attack(t).max_stored_bullets-1} 个位置分别判定额外生成，基础概率 ${num(attack(t).repetition_rate*100)}%，每级龙卷风增加 ${num(attack(t).repetition_rate_inc*100)} 个百分点。`, '存弹按预测剩余生命分配目标，携带爆破载荷的弹丸有单独的目标分配分支；上方一次伤害不能直接当作整轮齐射总伤害。'] })),
    entry('archmage-shred', '普攻永久削魔抗', [tpl('mage'), source(AS, 'function scripts.mod_damage.insert'), ...sharedArmorSources], (t) => ({ summary: `每枚普通魔法弹附带 ${num(ref(t,'mod_archmage_shatter').damage_min*100)} 个百分点的削魔抗效果。`, details: ['实际削减受目标护甲韧性影响；该效果没有配置到期恢复。它是修改目标魔抗，不能当成本次攻击独享的穿透。'] })),
  ],
  tower_sorcerer: [entry('sorcerer-curse', '普攻诅咒与持续伤害', [source(TS, 'scripts.tower_sorcerer ='), tpl('mage'), source(AS, 'function scripts.mod_armor_buff.insert'), source('all/script_utils.lua', 'function SU.armor_inc')], text('普攻除直接魔法伤害外，还施加持续 9 秒的减甲与持续伤害。', '减甲量为施加时目标当前物理护甲的 40%，再受护甲韧性影响；例如无韧性目标从 50% 降至 30%，不是减去 40 个百分点。该减甲到期会恢复。', '持续伤害模板为每 1.25 秒 12 点真实伤害、持续 9 秒，最多允许 2 份同类诅咒；重复施加还受效果去重/刷新逻辑约束。', '目标不能接受魔法或对应效果免疫时，不能保证附加效果生效。'))],
  tower_sunray: [entry('sunray-sharing', '范围内目标越多，每个目标伤害越低', [source(TS, 'scripts.tower_sunray ='), tpl('mage')], (t) => ({ summary: `围绕选中目标在 ${attack(t).radius} 范围内结算；每个目标的伤害乘以 4 / (3 + 实际目标数)。`, details: ['1 / 2 / 3 / 5 个目标时，每个目标分别承受 100% / 80% / 66.67% / 50% 的基础伤害。', '总伤害随目标数增加，但逐渐趋近单目标基础伤害的四倍；不能把单体面板直接乘以敌人数。'], formula: 'N 个目标：单体倍率 = 4/(3+N)，整轮总倍率 = 4N/(3+N)' }))],
  tower_high_elven: [entry('high-elven-volley', '五枚弹丸按当前生命排序分配', [source(TS, 'scripts.tower_high_elven ='), tpl('mage')], (t) => ({ summary: `当前脚本每轮发射 ${attack(t).bullets.length} 枚弹丸，而非仅凭描述理解为三发。`, details: ['先把候选敌人按当前生命从低到高排序，再循环分配弹丸；只有一个目标时，全部弹丸集中攻击它。', ...[...new Set(attack(t).bullets)].map(id=>`${id.includes('strong')?'强弹':'弱弹'}：${ref(t,id).bullet.damage_min}–${ref(t,id).bullet.damage_max} 点；每轮 ${attack(t).bullets.filter(x=>x===id).length} 枚。`)] }))],
  tower_goblirang: [entry('goblirang-return', '往返各命中一次，不是每帧重复伤害', [source(TS, 'scripts.goblirang ='), tpl('archer'), source('all/templates.lua', 'local mod_slow =')], (t) => ({ summary: '回旋镖沿飞行路径伤敌。每段行程对同一个敌人只造成一次伤害，开始返程时清空命中名单，因此同一枚最多往返各命中一次。', details: [`沿线检测宽度参数为 ${ref(t,'goblirang').bullet.damage_radius}；检测周期 ${num(ref(t,'goblirang').bullet.damage_every)} 秒不等于对同一敌人的伤害间隔。`, '普攻附加 0.1 秒、移动速度降至 50% 的短减速；是否两次都命中取决于敌人的移动与实际路径。'] }))],
  tower_dwaarp: [entry('dwaarp-control', '以塔为中心的全范围普攻', [source(TS, 'scripts.tower_dwaarp ='), tpl('engineer')], text('普攻对塔范围内符合条件的地面敌人逐个结算，而不是在某个落点做小范围溅射。', '基础普攻附加 0.4 秒减速，使移动速度降至 35%；对应的熔岩攻击减速为 0.8 秒、速度降至 25%。', '地面范围攻击和状态效果分别检查目标条件，不能据面板把它当成可以对空的普通射击。'))],
  tower_druid: [entry('druid-load', '储石、额外装填与落点分散', [source(TS, 'function scripts.tower_druid.update'), tpl('engineer'), source('kr1/foundamental_towers.lua', 'tt = RT("mod_rock_slow"'), source('all/templates.lua', 'local mod_slow =')], (t) => ({ summary: `最多储存 ${attack(t).max_loaded_bullets} 块巨石；一次装填至少增加一块，其余空位各有 ${num(attack(t).multi_rate*100)}% 概率再增加一块。`, details: ['开火会释放已储存巨石，额外巨石沿路径调整落点；不能保证三块全部命中同一个目标。', '普攻落点附带 0.75 秒减速，移动速度降至 50%；该效果来自基础巨石模板，不需要购买技能。'] }))],
  tower_entwood: [entry('entwood-bounce', '巨石弹跳衰减与基础减速', [tpl('engineer'), source(AS, 'scripts.bomb_bouncing ='), source('kr1/foundamental_towers.lua', 'tt = RT("mod_rock_slow"'), source('all/templates.lua', 'local mod_slow =')], (t) => ({ summary: `基础巨石落地后最多额外弹跳 ${ref(t,'rock_entwood').bounce_count} 次，弹跳伤害乘以 ${num(ref(t,'rock_entwood').bounce_factor*100)}%。`, details: ['只有附近找到可用目标时才弹跳；两次落点都能造成范围伤害，但不能把弹跳伤害无条件计入每次普攻。', '命中附加 0.75 秒减速，移动速度降至 50%。'] }))],
  tower_tricannon_lvl4: [entry('tricannon-volley', '三连炮与重复目标散布', [source(TS, 'function scripts.tower_tricannon.update'), tpl('engineer')], (t) => ({ summary: `一轮普攻发射 ${attack(t).bomb_amount} 枚炮弹，按候选敌人循环分配预判落点。`, details: [`同一轮再次分到同一个敌人，或目标已经丢失时，会额外加入横向最多 ${attack(t).random_x_to_dest}、纵向最多 ${attack(t).random_y_to_dest} 的随机落点偏移，再吸附到道路节点。`, '因此三枚炮弹不保证全部命中一个敌人；范围内敌人分布也会影响实际总伤害。'] }))],
  tower_spirit_mausoleum: [entry('mausoleum-storage', '空闲储存幽魂，再集中释放', [source(TS, 'function scripts.tower_spirit_mausoleum.update'), tpl('mage')], (t) => ({ summary: `未升级时最多储存 ${attack(t).max_charges} 枚幽魂弹；没有目标也会继续准备，达到上限才停止。`, details: ['有敌人时释放存弹，并根据预测剩余生命决定何时转向下一目标；单次面板伤害不代表整轮存弹爆发。', '储弹数量还可能被技能修改，以上是未购买技能的基准上限。'] }))],
  tower_melting_furnace: [entry('furnace-penetration', '全范围普攻自带穿甲与眩晕', [source(TS, 'function scripts.tower_melting_furnace.update'), tpl('engineer'), source('all/utils.lua', 'function U.calc_protection')], (t) => ({ summary: `普攻逐个伤害范围内地面敌人；本次伤害忽略 ${num(attack(t).reduce_armor*100)} 个百分点的物理护甲，并附加 0.6 秒眩晕效果。`, details: ['穿甲写入本次伤害对象，不会永久降低敌人护甲供其他塔使用。眩晕仍受敌人对应免疫和状态处理约束。', `基础出伤前摇为 ${attack(t).hit_times[0]} 秒；燃料强化分支使用约 ${num(attack(t).hit_times[1])} 秒，均再乘塔的冷却系数。`] }))],
  tower_blazing_watcher: [entry('blazing-ramp', '持续锁定升档，断开后重置', [source(TS, 'scripts.tower_blazing_watcher ='), source(TS, 'scripts.mod_tower_blazing_watcher_damage ='), tpl('mage')], text('持续攻击同一个目标会蓄能升档；无攻速增益时，超过 1.08 秒进入二档，超过 2.16 秒进入三档。', '实际伤害档位倍率为 1.375 / 2.25 / 3.125；购买对应蓄能技能后，超过 3.24 秒可进入四档，倍率为 4。', '蓄能按经过时间除以塔冷却系数累计，攻速影响升档速度。目标死亡、塔被封锁或光束被强制终止后，档位重置为一档。', '锁定后允许目标留在基础射程的 1.25 倍内，少量走出初始射程不会立即断开光束。'))],
  tower_rocket_riders: [entry('rocket-targeting', '引擎技能还会改变普攻选敌', [source(TS, 'function scripts.tower_rocket_riders.seek')], text('未购买引擎技能时按敌人距终点的路径节点数选敌；购买后改为评估目标后方的敌人分布。', '脚本统计与候选目标夹角差不超过 30°、且离发射点更远的敌人数量，选择得分最高的候选目标，以增加后续集束命中机会。', '因此升级后，即使攻击范围和面板伤害没变化，普攻的优先目标也可能改变。'), 'skill-interaction')],
}

// Mirror U.calc_protection's precedence; modifiers on the numeric damage type
// must not accidentally make a mixed flag look like plain magic/physical damage.
export function damageRule(value) {
  if (!Number.isInteger(value)) return null
  const rules = [
    [65536, '中毒伤害', '由目标毒抗结算，不直接使用物理护甲或魔抗。'],
    [1, '真实伤害', '护甲减伤系数为 0；目标的免疫、护盾及其他伤害钩子仍可能影响最终结果。'],
    [2 | 131072, '物理伤害', '按目标物理护甲减去本次攻击的穿甲值计算减伤。'],
    [4 | 262144, '魔法伤害', '按目标魔抗减去本次攻击的魔法穿透值计算减伤。'],
    [32, '魔法爆炸伤害', '令 M 为扣除本次魔法穿透后的魔抗，减伤比例 = M × (0.2M + 0.4)。例如 50% 魔抗对应 25% 减伤。'],
    [8192, '瓦解伤害', '护甲减伤系数为 0；是否可以作用于特定目标仍由攻击筛选、免疫和其他伤害处理决定。'],
    [8 | 128, '爆炸 / 猛击伤害', '令 A 为扣除本次穿甲后的物理护甲，减伤比例 = A × (0.2A + 0.4)。例如 50% 护甲对应 25% 减伤，100% 护甲对应 60% 减伤。'],
    [16, '电击伤害', '使用扣除穿甲后的物理护甲的一半作为减伤比例，例如 50% 护甲对应 25% 减伤。'],
    [64, '枪弹伤害', '使用扣除穿甲后的物理护甲的 70% 作为减伤比例，例如 50% 护甲对应 35% 减伤。'],
    [256, '刺击伤害', '令 A 为扣除本次穿甲后的物理护甲，减伤比例 = A × (2 − A)。例如 50% 护甲对应 75% 减伤。'],
    [512, '混合伤害', '若魔抗高于物理护甲，采用物理护甲；否则采用物理护甲与魔抗的平均值。双方先扣除各自穿透值；不是固定一半物理、一半魔法分别结算。'],
  ]
  const found = rules.find(([flag]) => (value & flag) !== 0)
  if (!found) return null
  return entry('damage-resolution', `${found[1]}的护甲结算`, [source('all/utils.lua','function U.calc_protection'), source('all/constants.lua','DAMAGE_PHYSICAL =')], text(found[2], '最终护甲减伤比例限制在 0%–100%。本条解释伤害类型，不代表整座塔的所有技能与召唤单位都使用相同类型。'), 'damage-rule')
}

for (const [towerId, definitions] of Object.entries(mechanicCatalog)) {
  for (const definition of definitions) {
    definition.sources = definition.sources.map(([file, anchor]) => [file, anchor === 'register_t' ? `"${towerId}"` : anchor])
  }
}
