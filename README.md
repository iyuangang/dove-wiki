# Dove 防御塔 Wiki

基于 `KingdomRushDove` 游戏 Lua 模板生成的 Vue 3 + TypeScript 动态塔典。当前数据快照包含 93 座唯一玩家塔、游戏百科顺序与原生图标、解锁关卡、基础面板、技能、分类标签和辅助增益计算器。

## 启动

```powershell
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:4173/`。

生产构建：

```powershell
npm run build
npm run preview
```

## 从 Dove 重新同步

默认游戏目录是：

```text
D:\KingdomRushDove-Windows-Cycle2-v0.1.5\KingdomRushDove
```

同步当前目录中的 Lua 模板、简体中文文本、解锁表、百科顺序和 DDS 图集：

```powershell
npm run sync:dove -- --game-dir "D:\KingdomRushDove-Windows-Cycle2-v0.1.5\KingdomRushDove"
```

同步器使用游戏自带的 `lovec.exe` 展开模板继承并调用每座塔的 `info.fn`，然后生成：

- `src/data/dove-data.json`：浏览器使用的规范化数据和校验报告；
- `public/encyclopedia/*.png`：游戏百科详情插图；
- `public/encyclopedia/thumbs/*.png`：游戏百科列表图标；
- `public/skills/*.png`：从塔菜单配置与 `gui_ico` 图集恢复的技能图标；
- `public/portraits/*.png`：从 `gui_portraits-1.dds` 恢复的透明头像；
- `tools/.tmp/dove-raw.json`：被 Git 忽略的中间数据。

如果 `lovec.exe` 不在游戏目录上一级，可额外传入 `--love-exe`。

## 数据口径

- 默认排序严格读取 `kr1-desktop/data/map_data.lua` 的 `tower_data` 数组；游戏百科未收录的 12 座 1–3 级基础塔按游戏塔族清单顺序后置。
- 百科收录的塔使用百科缩略图与详情插图；上述 12 座基础塔使用游戏头像回退。
- 不计算星级科技、英雄、地图环境和外部配置修改。
- 基础 DPS 是单目标理论值，不把范围目标数、召唤物存活时间和随机技能强行合并。
- 增伤百分比相加；增距倍率相乘；攻击间隔按 `基础间隔 ÷ (1 + 总攻速加成)` 计算。
- 兵营塔接受增距时，结果显示集结范围。
- 黑暗精灵的随机击杀增益按目标实际获益次数计算，并遵守技能等级上限。

当前游戏快照有 15 座塔位于初始锁定表，却没有任何关卡声明其解锁。Wiki 将其明确标记为数据异常，不推测关卡。

## 校验

```powershell
npm run test
npm run build
```

单元测试覆盖伤害相加、范围相乘、攻速换算、黑暗精灵触发上限和兵营集结范围。
