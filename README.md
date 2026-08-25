# 王国保卫战鸽子版 WIKI

基于 `KingdomRushDove` 游戏 Lua 模板生成的 Vue 3 + TypeScript 游戏百科。当前数据快照包含 93 座唯一玩家塔、77 名英雄、300 个敌人百科槽位、4 套完整科技方案、更新记录和科技/辅助增益计算器。

## 参与项目

不会写代码也可以参与：欢迎通过 [Issue](https://github.com/iyuangang/dove-wiki/issues/new) 反馈页面问题、游戏数据错误或提出建议。会写代码的贡献者可以开发新功能、修复 Bug 或改进数据同步；除很小的修改外，建议开发前先创建 Issue 讨论范围。

分支流程、数据更新方法、三个 GitHub Actions 工作流的触发方式和开发共识，请阅读 [参与指南](./CONTRIBUTING.md)。

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

同步当前目录中的 Lua 模板、简体中文文本、解锁表、科技树、百科顺序和 DDS 图集：

```powershell
npm run sync:dove -- --game-dir "D:\KingdomRushDove-Windows-Cycle2-v0.1.5\KingdomRushDove"
```

同步器使用游戏自带的 `lovec.exe` 展开模板继承并调用每座塔的 `info.fn`，然后生成：

- `src/data/dove-data.json`：浏览器使用的规范化数据和校验报告；
- `src/data/game-changelog.json`：按游戏版本累计的结构化更新差异；
- `public/encyclopedia/*.png`：游戏百科详情插图；
- `public/encyclopedia/thumbs/*.png`：游戏百科列表图标；
- `public/skills/*.png`：从塔菜单配置与 `gui_ico` 图集恢复的技能图标；
- `public/portraits/*.png`：从 `gui_portraits-1.dds` 恢复的透明头像；
- `public/heroes/*.png`、`public/enemies/*.png`：英雄和敌人百科图；
- `public/technologies/*.png`：四套方案的游戏原生科技图标；
- `tools/.tmp/dove-raw.json`：被 Git 忽略的中间数据。

同步前会保留当前数据快照；当游戏提交哈希发生变化时，同步器自动比较前后版本，记录新增、移除、关键数值、技能说明与科技变化。同一游戏提交重复同步不会产生重复记录。

如果 `lovec.exe` 不在游戏目录上一级，可额外传入 `--love-exe`。

## 数据口径

- 默认排序严格读取 `kr1-desktop/data/map_data.lua` 的 `tower_data` 数组；游戏百科未收录的 12 座 1–3 级基础塔按游戏塔族清单顺序后置。
- 百科收录的塔使用百科缩略图与详情插图；上述 12 座基础塔使用游戏头像回退。
- 游戏版本显示 `version.lua` 的构建 ID（当前为 `2.0.6.4`），同时在数据页保留内容短版本与内部标识。
- 科技选择直接读取 `kr1/upgrades.lua` 的 4 套方案；按塔族累计应用到所选等级，再叠加玩家塔辅助效果。
- 能稳定映射到面板的科技会计算伤害、范围、攻击间隔、价格和驻防属性；穿甲、暴击、流血、连续破甲、低护甲增伤、附加魔伤、对空增伤、不稳定魔力、肃清立场与魔法粉尘会继续进入傀儡逐击模拟。
- 不计算英雄、地图环境和外部配置修改。
- 基础 DPS 是单目标理论值，不把范围目标数、召唤物存活时间和随机技能强行合并。
- 科技先修改基础模板；辅助增伤百分比相加、增距倍率相乘，攻击间隔按 `科技后间隔 ÷ (1 + 总攻速加成)` 计算。
- 兵营塔接受增距时，结果显示集结范围。
- 黑暗精灵的随机击杀增益按目标实际获益次数计算，并遵守技能等级上限。

当前游戏快照中的 59 座关卡解锁塔均已定位到实际 `level*.lua` 或 `level*_data.lua` 来源，没有未匹配的初始锁定塔。

## 校验

```powershell
npm run test
npm run build
```

单元测试覆盖版本字段、更新差异生成与去重、技能图标关联、科技树完整性、科技数值、伤害相加、范围相乘、攻速换算、黑暗精灵触发上限和兵营集结范围。

## CI/CD 与发布

面向贡献者的简明操作步骤见 [参与指南：三个 GitHub Actions 工作流](./CONTRIBUTING.md#三个-github-actions-工作流)。以下内容保留发布实现细节。

- PR 到 `dev`、`main`，以及向这两个分支推送时，GitHub Actions 会执行 `npm ci`、测试和带 `/dove-wiki/` 基路径的生产构建。
- Pages 流水线不会在云端重新同步游戏数据；版本库中的 `src/data` 与 `public` 是发布输入。
- 常规代码版本仍由指向 `main` 最新提交的稳定 SemVer Tag（例如 `v1.0.0`）创建 GitHub Release 并部署到 `https://iyuangang.github.io/dove-wiki/`。
- 只有游戏数据变化时，无需再把整个 `dev` 合并到 `main`：同步并推送 `dev` 后，在 Actions 中运行 **Publish synced game data**，输入新的 `v*` 版本号。流水线会以最新 `main` 代码叠加 `dev` 中的生成数据，完成测试、创建隔离 Tag，并自动启动 Release 与 Pages 部署。
- Release 附带可独立部署的 ZIP 文件及其 SHA-256 校验文件，页面同时显示游戏版本和站点版本。

发布前先按协作流程把 `dev` 合并到 `main`，然后执行：

```powershell
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

仅发布游戏数据时：

1. 从最新 `dev` 建立独立分支，执行 `npm run sync:dove` 和必要检查，再通过 PR 将生成数据合入 `dev`。
2. 确认数据 PR 已合并且 `dev` 包含最新 `main`，打开仓库 Actions → **Publish synced game data** → **Run workflow**。
3. 输入新的稳定版本号，例如 `v1.2.6`。无需手动把 `dev` 合入 `main` 或创建 Tag。

数据专用流水线只会从 `dev` 取 `src/data` 中的生成快照和 `public` 下的游戏资源；站点代码始终取最新 `main`，避免把尚未发布的功能一起带入线上。

本地模拟 Pages 构建：

```powershell
$env:VITE_BASE_PATH='/dove-wiki/'
$env:VITE_APP_VERSION='v0.0.0-local'
npm run build
Remove-Item Env:VITE_BASE_PATH
Remove-Item Env:VITE_APP_VERSION
```
