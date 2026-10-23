# Dove 2.0.9.9 计算机制复核

审阅日期：2026-10-22。游戏提交：`7b0ab70aad95121ed10a62eb6e00b33ce21e1146`。相同版本号的其他提交仍按依赖指纹判断；同步工具不自动续签审阅。

本次范围为之前暂停的 11 项辅助效果，以及计算器中的条件和概率科技。检查顺序为模板参数、原生释放条件、修饰器插入／移除、共享叠加函数和伤害结算。未声明覆盖所有英雄、所有技能或所有关卡。

| 辅助效果 | 复核入口 | 结论 |
| --- | --- | --- |
| 驯鹰者 | archer_towers / mod_crossbow_eagle；game_scripts 的同名 insert/remove | 增距 5/7.5/10%，攻速除数增量 15/20/25%；半径 170/210/250；支持兵营集结范围 |
| 眺望 | archer_towers / mod_pirate_watcher；game_scripts 的同名 insert/remove | 增距 10/20/30%，半径 250；不提供攻速 |
| 苍穹之眼 | tower_scripts / tower_archers.update，skill_b_range_factor | 按椭圆距离衰减，边缘为中心加成一半；保留更强同类效果，失去源塔覆盖后移除；参数来自模板 |
| 元素赐福 | mage_towers / mod_high_elven；game_scripts / mod_high_elven | 增伤 13.5/18/22.5%，攻速除数增量 9/12/15%；半径 180/240/300 |
| 强化光环 | mage_towers / tower_arcane_wizard_lvl4；tower_scripts / tower_arcane_wizard5.update | 增伤 15/25/40%，半径 240；较高等级替换较低等级；排除可见性规则不允许的塔 |
| 知识之卷 | tower_scripts / tower_wizard.update 的 skill_b 分支 | 范围内存在敌人才施放；源塔范围、持续时间及增伤来自模板；检查可强化、未封锁、可见性条件；显示生效期间峰值 |
| 摩擦生热 | engineer_towers / mod_furnace_buff；tower_scripts / tower_melting_furnace.update | 每级 15% 增伤，共两级；半径 291.5；同类高等级替换低等级 |
| 燃料爆燃 | engineer_towers / mod_furnace_fuel；tower_scripts 同名 insert/remove | 攻速除数增加 0.5，持续 10 秒、基础冷却 30 秒；实际触发还需要进攻目标 |
| 猎杀戾气 | archer_towers / skill_buff；tower_scripts / bullet_tower_dark_elf_skill_buff | 死亡灵魂传递到 225 范围随机可强化塔；其他塔每次当前增伤 0.8%；升级重放另用累计 8%，继续在说明中区分；不把自身成长当作其他塔收益 |
| 皇家号令 | heroes / tower_buff、mod_denas_tower；hero_scripts 对应释放与修饰器 | 半径 200，增距 25%，攻速除数增量 25%，持续 5/8/11 秒；基础冷却 11.7 秒 |
| 空间扭曲 | heroes / spatial_distortion；hero_scripts 的全场目标筛选 | 全场可强化且未封锁的塔，增伤／增距／攻速除数增量 4/6/8%，持续 6/7/8 秒，冷却 25/23/20 秒 |

共同依赖：`all/script_utils.lua` 的增距、冷却和伤害函数；`all/scripts.lua` 的 `mod_tower_factors`；修饰器生命周期。增距乘算、伤害增量相加、冷却系数转换成攻速除数增量；插入和移除对称。`change_fps` 已缩放命中／施法时序，不能再重复乘一次冷却系数。

| 条件／概率机制 | 复核入口 | 当前计算口径 |
| --- | --- | --- |
| 穿透、致命精度 | upgrades.archer_piercing / archer_precision；tower_scripts.apply_precision；all/scripts 弹丸分支 | 忽略 0.1 护甲即面板 10 点；10% 概率两倍伤害 |
| 护甲撕裂 | upgrades 的严格伤害阈值；game_templates 的四种 mod_archer_tear | 模板平均伤害严格大于 10/20/40 分档；辅助增伤不抬档；降低 0.16/0.44/0.72/1 点护甲 |
| 奥术碎裂 | upgrades.mage_arcane_shatter；game_templates.mod_arcane_shatter | 模板最大伤害 ≥50 或 ray_arcane 使用 3.5 点，否则 2 点 |
| 黑曜石、魔法箭、对空加成 | upgrades 对应挂钩；game_scripts.mod_archer_magic | 减伤 ≤0.1 时 ×1.27；追加 12% 魔伤、向上取整至少 1；对空额外 ×1.25 |
| 魔法打击、非稳态魔法 | upgrades.mage_strike / mage_unsteady；all/utils.predict_damage | 无减伤时 ×1.2；10% 概率两倍无减伤伤害，但完全免疫不由此穿透 |
| 肃清立场 | game_scripts.controller_mage_purge_field | 初始 +14%，每秒按射程内敌人数更新，每名 +1%，最多再 +30% |
| 魔法尘埃 | upgrades.engineer_magic_dust 及补偿分支 | 普通命中 10% 概率追加 最大生命 ×0.004×√(本击伤害+1)；不能收到命中挂钩的塔走固定补偿 |
| 放血 | game_templates.mod_blood_elves；game_scripts.insert；all/scripts.mod_dps | 15% 触发，依预测有效伤害 ×10%、至少 1；每 4 帧一跳、最多五层；当前模拟保留三秒窗口的 23 次结算 |

本次补充魔法尘埃的 `tower_culverine`、`tower_alchemist` 固定补偿分类，避免把已走原生补偿的主攻击再当作普通概率命中。

伤害顺序另查 `all/utils.lua`、`all/systems/health.lua`：目标回调可能拒绝／改写伤害；先取得减伤并运行伤害挂钩，再预测实际扣血；护甲下降与普通伤害分支不同。修复没有改变强度天梯的权重、场景或原始轮次。

验证覆盖由测试输出记录：数值边界、失效指纹撤回、当前快照辅助和科技恢复，以及原生引擎的健康结算／战斗测试。源码审阅与模拟验证不等同于完整关卡实战。
