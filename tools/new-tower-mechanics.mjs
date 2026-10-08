// Reviewed against Dove 2.0.8.9. Each item depends on both parameters and logic.
const TS = 'kr1/tower_scripts.lua'
const AS = 'all/scripts.lua'
const SU = 'all/script_utils.lua'
const U = 'all/utils.lua'
const src = (file, symbol) => [file, symbol]
const tpl = (family, id) => src(`kr1/${family}_towers.lua`, `RT("${id}"`)
const entry = (id, title, sources, build, kind = 'intrinsic') => ({ id, title, sources, build, kind })
const text = (summary, ...details) => () => ({ summary, details })
const n = (value) => Number(value.toFixed(3))
const values = (array, scale = 1) => array.map((value) => n(value * scale)).join(' / ')
const attacks = (t) => t.template.attacks.list
const ref = (t, id) => t.references[id]
const catapult = [tpl('engineer', 'tower_catapult'), src(TS, 'function scripts.tower_catapult.update')]
const archers = [tpl('archer', 'tower_archers'), src(TS, 'function scripts.tower_archers.update')]
const wizard = [tpl('mage', 'tower_wizard'), src(TS, 'function scripts.tower_wizard.update')]
const knights = [tpl('barrack', 'tower_knights'), tpl('barrack', 'soldier_knights'), src(TS, 'function scripts.soldier_knights.update')]

export const newTowerMechanics = {
  tower_catapult: [
    entry('catapult-direction', '朝向会改变普攻计时', catapult, (t) => ({
      summary: `基础冷却参数为 ${attacks(t)[0].cooldown} 秒；攻击原点右侧且上方（目标 x 更大、y 不大于原点）走无需转向的分支。`,
      details: [`该分支在瞄准和回正时各将普攻计时向前拨 ${n(t.template.rotation_time)} 秒，合计 ${n(t.template.rotation_time * 2)} 秒；存在攻速增益时，两次调整均乘塔冷却系数。`, '其他方向会等待转向和回正动画；装填、大招、失去目标也占用流程，因此不能将面板冷却直接当成所有朝向的实际发射间隔。'],
      formula: '无需转向时：普攻计时额外提前 = 2 × rotation_time × 塔冷却系数',
    })),
    entry('catapult-tar', '焦油弹替换下一轮普攻', [...catapult, src(TS, 'function scripts.aura_catapult_skill_a.insert'), src(TS, 'function scripts.mod_catapult_skill_a_slow.insert')], (t) => ({
      summary: `技能就绪时在装填阶段改装焦油弹，占用下一次普攻；技能冷却 ${attacks(t)[1].cooldown} 秒。`,
      details: [`焦油弹保留基础 ${ref(t, 'bullet_catapult_skill_a').bullet.damage_min}–${ref(t, 'bullet_catapult_skill_a').bullet.damage_max} 爆炸伤害，落点留下半径 ${ref(t, 'aura_catapult_skill_a').aura.radius} 的区域，持续 ${values(ref(t, 'aura_catapult_skill_a').aura.duration_conf)} 秒。`, `区域内反复施加短减速，速度降至 ${values(ref(t, 'mod_catapult_skill_a_slow').slow_factor_config, 100)}%；不是另加一枚不占普攻流程的炮弹。`],
    }), 'skill-interaction'),
    entry('catapult-extra-explosion', '强化弹在落点延迟再爆炸', [...catapult, src(TS, 'scripts.bullet_catapult ='), src(TS, 'function scripts.aura_catapult_skill_b_bomb.update')], (t) => {
      const b = ref(t, 'aura_catapult_skill_b_bomb')
      return { summary: '购买强化技能后，普通弹、焦油弹和大招投射弹都会携带额外爆炸。', details: [`落地后再等待 ${n(b.explosion_delay + b.cast_time)} 秒爆炸，范围 ${b.damage_radius}；各级最小伤害 ${values(b.damage_min_conf)}，最大伤害 ${values(b.damage_max_conf)}。`, '无工程效率科技时按目标距爆心的距离从最大值衰减至最小值，并向下取整；工程效率令范围内目标使用最大值。', '伤害在延迟结束后重新找目标，不能保证与首次落地命中同一批敌人。'] }
    }, 'skill-interaction'),
    entry('catapult-traps', '陷阱数量、间距与触发延迟', [...catapult, src(TS, 'function scripts.aura_catapult_skill_c_trap.update'), src(TS, 'function scripts.mod_catapult_skill_c_stun.insert')], (t) => ({
      summary: `最多同时保留 ${values(t.template.powers.skill_c.max_traps)} 个陷阱；布置冷却 ${attacks(t)[2].cooldown} 秒。`,
      details: [`布置点在塔附近 ${attacks(t)[2].max_range} 范围内的可用陆地随机选择，要求距附近其他陷阱严格超过 ${attacks(t)[2].min_dist_between_traps}。没有可用位置时不能保证按冷却成功布置。`, `敌人进入半径 ${ref(t, 'aura_catapult_skill_c_trap').aura.radius} 后，先等待 12 帧（默认 0.4 秒）再重新找目标，造成物理伤害与 ${values(ref(t, 'mod_catapult_skill_c_stun').stun_duration_config)} 秒眩晕；Boss 被禁止接受该眩晕。`, '每个陷阱只触发一次；更新脚本没有按存放时间自动失效的分支。目标在触发动作期间离开，可能避开最后的伤害判定。'],
    }), 'skill-interaction'),
    entry('catapult-ultimate', '自带滚动火球沿路回溯', [...catapult, src(TS, 'function scripts.aura_catapult_ultimate.update')], (t) => {
      const a = ref(t, 'aura_catapult_ultimate')
      return { summary: `大招自带，无需购买技能；冷却 ${attacks(t)[3].cooldown} 秒，投射后火球沿道路向入口方向滚动。`, details: [`滚动接触造成 ${a.damage_min} 点爆炸伤害并附加燃烧；已有同种燃烧效果的敌人跳过这一轮接触伤害，不能按每 ${n(a.aura.cycle_time)} 秒持续命中同一敌人计算。`, `回溯超过 ${a.max_nodes} 个路径节点时，追加半径 ${a.explosion_damage_radius} 的 ${a.explosion_damage_min} 点爆炸；提前到达路径起点会结束，不能无条件计入最终爆炸。`, '目标路径必须有效，且不能属于关卡禁止回溯的路径；技能与普攻共用塔的动作流程。'] }
    }),
  ],
  tower_archers: [
    entry('archers-rotation', '四名弓手轮流领取射击指令', [...archers, src(TS, 'function scripts.controller_archers_shooter.update')], (t) => ({
      summary: `${t.template.shooters_sids.length} 名弓手共用 ${attacks(t)[0].cooldown} 秒的普攻调度冷却，每次指令只安排一名空闲弓手。`,
      details: ['所有弓手都在忙时会等待；不能将面板 DPS 再乘以四。普通选敌优先考虑飞行敌人，释放时仍会重新检查射程与存活状态。', '某名弓手执行技能时会占用自身动作，其他空闲弓手仍可领取普通射击指令。'],
    })),
    entry('archers-lines', '穿筋箭按两条射线伤敌', [...archers, src(TS, 'scripts.bullet_archers_skill_a ='), src(TS, 'function scripts.mod_archers_skill_a_stun.insert')], (t) => ({
      summary: `技能冷却 ${attacks(t)[1].cooldown} 秒；同一名弓手连续发射 ${attacks(t)[1].targets} 条射线，对沿线敌人逐个结算物理伤害。`,
      details: [`每条射线对同一敌人只命中一次，附加 ${values(t.template.powers.skill_a.stun_duration)} 秒眩晕，Boss 禁止接受该眩晕。`, '第二条射线要求目标位于同侧；没有合适的第二目标时可以重复朝原目标发射。因此不是只能伤害两名敌人，也不保证选中两名不同敌人。'],
    }), 'skill-interaction'),
    entry('archers-range', '射程光环随塔间距离衰减', [...archers, src(SU, 'function SU.insert_tower_range_buff'), src(AS, 'function scripts.mod_tower_factors.insert'), src('all/systems/mod_lifecycle.lua', 'function mod_lifecycle:on_insert')], (t) => ({
      summary: `天空之眼对范围内可接受效果的塔持续提供射程增益；中心最大增加 ${values(t.template.powers.skill_b.range_factor.map((v) => v - 1), 100)}%。`,
      details: ['距离按塔坐标的椭圆距离计算。到光环边界时仅剩最大加成的一半；光环半径使用弓兵要塞当前攻击范围，外部射程增益会改变它。', '同种射程效果只保留更强的一个，不将多座要塞的同类光环相乘；离开范围或出售来源塔会撤回对应效果。', '通用范围增益函数允许影响兵营的集结范围；仍须通过目标的效果许可、封锁与标记检查。'],
      formula: '实际射程倍率 = 1 + (技能倍率 − 1) × (1 − d / (2R))，0 ≤ d ≤ R',
    }), 'skill-interaction'),
    entry('archers-mark', '鹰之印记易伤，Boss 增幅减半', [...archers, src(TS, 'function scripts.mod_archers_skill_c_weak.insert'), src(AS, 'function scripts.mod_damage_factors.insert'), src('all/constants.lua', 'BIG_ENEMY_HP =')], (t) => {
      const m = ref(t, 'mod_archers_skill_c_weak')
      return { summary: `给高生命且尚无同类印记的敌人施加 ${values(m.received_damage_factor_config)} 倍受伤倍率，持续 ${values(m.modifier_duration)} 秒。`, details: [`选敌使用当前生命至少 750（BIG_ENEMY_HP），而非敌人最大生命；技能冷却 ${attacks(t)[3].cooldown} 秒，施法后目标还须存活。`, `Boss 的增幅折半，实际倍率为 ${values(m.received_damage_factor_config.map((v) => 1 + (v - 1) / 2))}。这项倍率乘入目标受伤倍率，并非永久降低护甲。`, '印记到期后还要等待退场动画才移除实体并撤销倍率，因此配置持续时间不是精确的实测撤销时刻。'] }
    }, 'skill-interaction'),
    entry('archers-haste', '自带大招只加速普攻调度', [...archers, src(TS, 'function scripts.mod_archers_ultimate_haste.insert'), src(TS, 'function scripts.mod_archers_ultimate_haste.update'), src(TS, 'function scripts.mod_archers_ultimate_haste.remove')], (t) => ({
      summary: `自带大招冷却 ${attacks(t)[4].cooldown} 秒，将普攻调度冷却乘以 ${ref(t, 'mod_archers_ultimate_haste').cooldown_factor}；技能冷却保持各自数值。`,
      details: [`无外部加速时，普攻调度参数由 ${attacks(t)[0].cooldown} 变为 ${n(attacks(t)[0].cooldown * ref(t, 'mod_archers_ultimate_haste').cooldown_factor)} 秒。`, `增益有进场、持续 ${attacks(t)[4].duration} 秒、退场动作；只直接修改第一项攻击的冷却，不会同步将所有弓手动画和技能施法时间减半。`],
    })),
  ],
  tower_wizard: [
    entry('wizard-double-bolt', '普攻每轮两弹，可能分给邻近敌人', wizard, (t) => {
      const b = ref(t, attacks(t)[0].bullet).bullet
      return { summary: `每轮普攻发射两枚 ${b.damage_min}–${b.damage_max} 点魔法伤害弹丸；基础冷却 ${attacks(t)[0].cooldown} 秒。`, details: ['第二枚有 50% 概率改打列表中的第二目标，但它须与原目标相距小于 50；否则两枚集中攻击原目标。', '两枚之间等待 0.15 秒乘塔冷却系数；热身、技能动作和目标失效会影响实际节奏。', `上方面板为单枚参数。两枚都命中同一目标时，该轮基础总伤害 ${b.damage_min * 2}–${b.damage_max * 2}；仅按冷却估算为 ${n((b.damage_min + b.damage_max) / attacks(t)[0].cooldown)} DPS，未计动作与其他影响。`] }
    }),
    entry('wizard-firebook', '火焰书的直接伤害与燃烧分开缩放', [...wizard, src(AS, 'function scripts.bomb.update'), src(AS, 'function scripts.mod_dps.update')], (t) => ({
      summary: `火焰书直接伤害参数为 ${values(t.template.powers.skill_a.damage_min)} 点魔法爆炸伤害，落点范围 ${ref(t, 'bullet_firebook_wizard').bullet.damage_radius}。`,
      details: [`另附 ${values(t.template.powers.skill_a.burn_damage)} 点一跳的燃烧，模板持续 ${ref(t, 'mod_firebook_aura').modifier.duration} 秒、每 ${ref(t, 'mod_firebook_aura').dps.damage_every} 秒结算；实际跳数受调度、刷新和目标状态影响。`, '脚本把燃烧等级倍率写进弹丸伤害系数，同时先除回直接伤害，不能把直接伤害再次乘以燃烧升级倍率。直接爆炸还受爆心距离、工程效率与目标抗性影响。'],
    }), 'skill-interaction'),
    entry('wizard-empower', '知识卷轴给周围塔加伤害倍率', [...wizard, src(AS, 'function scripts.mod_tower_factors.insert'), src(SU, 'function SU.insert_tower_damage_factor_buff')], (t) => ({
      summary: `技能冷却 ${attacks(t)[2].cooldown} 秒，为周围可接受效果的塔增加 ${values(attacks(t)[2].damage_factor.map((v) => v - 1), 100)}% 伤害倍率，持续 ${values(attacks(t)[2].duration)} 秒。`,
      details: ['施法前必须先找到范围内敌人；随后按当前塔攻击范围扫描受益塔，并检查效果许可、封锁及筛选标记。', '通用函数向伤害倍率加上增量，与其他塔伤害加成按加法合并；不能把每种增伤一律相乘。现有兵营士兵也按通用函数同步获得增量。'],
    }), 'skill-interaction'),
    entry('wizard-copies', '备用副本落地后发射有限弹丸', [...wizard, src(TS, 'function scripts.controller_tower_wizard_book_bounce.update'), src(TS, 'function scripts.aura_wizard_skill_c.update')], (t) => {
      const a = ref(t, 'aura_wizard_skill_c')
      return { summary: `初次投掷按 ${attacks(t)[3].hit_min_damage} 点直接命中参数处理；书本再弹向附近道路节点，落地后发射 ${values(a.bullet_count)} 枚魔法弹。`, details: [`副本搜索范围固定 ${a._range}；各级单枚伤害为 ${a.min_damage.map((v, i) => `${v}–${a.max_damage[i]}`).join(' / ')}。`, '副本会逐枚重新找敌人；找不到敌人时弹丸射向随机落点，仍消耗数量。它不是在整个持续时间内无限射击，也不能保证所有弹丸都命中。', '落地点会避开配置的不可用地形；数量耗尽后等待并淡出。'] }
    }, 'skill-interaction'),
    entry('wizard-ultimate', '自带陨星：单体伤害、周围眩晕', [...wizard, src(TS, 'function scripts.mod_wizard_ultimate.update')], (t) => {
      const m = ref(t, 'mod_ultimate_wizard')
      return { summary: `自带大招冷却 ${attacks(t)[4].cooldown} 秒，对选中且仍存活的敌人造成 ${m.damage} 点魔法伤害。`, details: [`半径 ${m.stun_range} 内符合条件的地面敌人接受 ${ref(t, 'mod_stun_ultimate_wizard').modifier.duration} 秒眩晕；周围敌人不会同时分到这 ${m.damage} 点伤害。`, '伤害与周围眩晕分开判定；选中目标失效时，也不能把陨星按全范围伤害计入 DPS。'] }
    }),
  ],
  tower_knights: [
    entry('knights-heroes', '英雄在士兵身边才触发鼓舞', [...knights, src(TS, 'function scripts.aura_knights_skill_a.update'), src(AS, 'function scripts.mod_armor_buff.insert'), src(AS, 'function scripts.mod_damage_factors.insert'), src(SU, 'function SU.update_armor'), src('all/systems/mod_lifecycle.lua', 'function mod_lifecycle:on_insert')], (t) => {
      const s = ref(t, 'soldier_knights'), p = s.powers.skill_a
      return { summary: `每名骑士独立扫描自身周围 ${ref(t, 'aura_knights_skill_a').aura.radius} 范围内存活英雄；每名英雄提供 ${values(p.extra_armor, 100)} 个百分点的物理护甲增量。`, details: [`范围内英雄同时获得 ${values(p.hero_damage_factor, 100)}% 输出倍率增幅；护甲按英雄数量叠加，英雄增伤则由同类效果的去重规则处理，不能直接乘以骑士人数。`, '以骑士位置为中心，移动集结点会改变受益区域；英雄离开后，短时效果停止刷新并到期撤销。', '护甲增量受护甲韧性影响；普通基础护甲不足 100% 的单位，通用更新函数将最终护甲上限限制为 99%。'] }
    }, 'skill-interaction'),
    entry('knights-overheal', '战斗间隙分两次治疗，可超额回血', [...knights, src(U, 'function U.heal_with_overflow')], (t) => {
      const s = ref(t, 'soldier_knights'), p = s.powers.skill_b, a = s.timed_attacks.list[0]
      return { summary: `治疗技能冷却 ${a.cooldown} 秒，每次合计恢复最大生命的 ${values(p.hp_ptg, 100)}%，上限为最大生命的 ${p.hp_overflow_factor} 倍。`, details: [`总量分两半，在动作第 ${n(a.cast_times[0] * 30)} 与 ${n(a.cast_times[1] * 30)} 帧结算。基础 200 生命时合计恢复 ${values(p.hp_ptg.map((v) => v * s.health.hp_max))} 点，允许涨至 ${s.health.hp_max * p.hp_overflow_factor} 点当前生命。`, '须处于近战目标的攻击冷却间隙，且当前生命低于超额上限；空闲时走普通再生，不能按此技能冷却无条件持续加血。'] }
    }, 'skill-interaction'),
    entry('knights-fallen', '附近出现死亡友军后切换快攻', [...knights, src(TS, 'function scripts.aura_knights_skill_c_check.update')], (t) => {
      const s = ref(t, 'soldier_knights')
      return { summary: `购买技能后，检测到自身 ${ref(t, 'aura_knights_skill_c_check').aura.radius} 范围内死亡友军时，关闭普通近战并启用第二近战。`, details: [`第二近战冷却为基础冷却的 ${values(s.powers.skill_c.cd_mult)} 倍；基础 ${s.melee.attacks[0].cooldown} 秒对应 ${values(s.powers.skill_c.cd_mult.map((v) => v * s.melee.attacks[0].cooldown))} 秒。`, '检测不消耗尸体，已过期援军不算；该士兵启用后没有重新关闭的分支，之后移动离开尸体不会撤销。新生骑士需要重新满足检测条件。'] }
    }, 'skill-interaction'),
    entry('knights-last-stand', '自带低血量防伤与真实反伤', [...knights, src(U, 'function U.insert_on_damage'), src('all/systems/health.lua', 'h.on_damage')], (t) => {
      const a = ref(t, 'soldier_knights').timed_attacks.list[1]
      return { summary: `技能计时就绪、生命严格低于 ${n(a.hp_trigger * 100)}%，且附近 200 内有可阻挡地面敌人时触发；基础冷却 ${a.cooldown} 秒。`, details: [`持续 ${a.duration} 秒的受伤回调返回 false，取消进入该回调的伤害；同时按传入原始伤害值 × 骑士输出倍率生成真实反伤。不是按护甲减伤后的实际掉血量反弹。`, '优先反伤给具备生命组件的伤害来源；找不到时退回当前近战目标。没有可用目标时可防伤但没有反伤对象。', '本回调在下一次受伤且时间严格超过持续时长时自移除；免疫等前置条件、其他回调或直接脚本移除仍会影响结果。'], formula: '反伤值 = 传入 damage.value × 骑士 unit.damage_factor，类型为真实伤害' }
    }),
  ],
}
