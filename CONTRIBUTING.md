# 参与王国保卫战鸽子版 WIKI

感谢你愿意帮助完善这个项目。无论会不会写代码，都可以参与。

## 先选择你的参与方式

| 我想做什么 | 推荐方式 |
| --- | --- |
| 反馈页面错误、数据错误或使用问题 | [创建 Issue](https://github.com/iyuangang/dove-wiki/issues/new) |
| 提议新页面、新功能或体验优化 | [创建 Issue](https://github.com/iyuangang/dove-wiki/issues/new) |
| 修复 Bug | 先创建或认领 Issue，再从 `dev` 建立 `fix/*` 分支并提交 PR |
| 开发新功能 | 先用 Issue 讨论范围，再从 `dev` 建立 `feature/*` 分支并提交 PR |
| 同步新版游戏数据 | 运行本地同步工具，将生成结果通过 PR 合入 `dev` |

不确定应该选哪一种时，直接创建 Issue 即可。维护者可以协助确认问题类型和下一步。

## 不会写代码：反馈问题或提出建议

提交前可以先搜索现有 Issue，避免重复。描述不需要使用专业术语，把你看到的情况说清楚就足够了。

反馈问题时，建议提供：

- 简短标题，例如“更新页刷新后回到塔典”；
- 出现问题的页面地址；
- 实际结果和你认为正确的结果；
- 能稳定复现问题的操作步骤；
- 游戏版本、设备和浏览器；
- 截图或游戏内百科依据，尤其是数值、图标和解锁关卡问题。

提出建议时，建议说明：

- 现在遇到了什么不便；
- 希望增加或改变什么；
- 这个变化能帮助哪些玩家。

Issue 是公开内容，请勿提交密码、Token、私钥、账号信息或包含这些内容的日志。

## 会写代码：开发与提交 PR

### 开发前

除错别字等很小的改动外，建议先创建 Issue，并在开始开发前说明准备采用的方案。这样可以尽早统一数据口径和交互方式，也能避免多人重复开发。

本地开发推荐使用 Node.js 24 和 npm。第一次启动：

```powershell
npm ci
npm run dev
```

浏览器访问 `http://127.0.0.1:4173/`。

### 分支流程

```text
feature/fix → PR → dev → PR → main
```

- `main`：线上稳定版本，只用于发布，不直接提交代码；
- `dev`：日常开发集成分支；
- `feature/*`：新功能，例如 `feature/enemy-filters`；
- `fix/*`：Bug 修复，例如 `fix/mobile-select`。

有仓库写入权限时，可以直接从最新 `dev` 建分支：

```powershell
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feature/short-name
```

外部贡献者可以先 Fork 仓库，再从上游 `dev` 建分支：

```powershell
git clone git@github.com:你的账号/dove-wiki.git
cd dove-wiki
git remote add upstream https://github.com/iyuangang/dove-wiki.git
git fetch upstream
git switch -c feature/short-name upstream/dev
```

完成后运行必要检查：

```powershell
npm test
npm run build
```

提交信息保持简洁明确，推荐使用：

- `feat:` 新功能；
- `fix:` Bug 修复；
- `refactor:` 重构；
- `docs:` 文档；
- `test:` 测试；
- `chore:` 工具、依赖或数据同步。

推送分支后，创建目标为 `dev` 的 PR。PR 中请写清：

- 解决了什么问题，并关联 Issue，例如 `Closes #123`；
- 主要改动和仍未覆盖的边界；
- 执行过哪些测试；
- 界面改动附桌面端和手机端截图。

CI 通过并完成必要检查后再合并。`dev` 合入 `main` 和正式发布由维护者统一处理。

## 更新游戏数据

数据同步需要 Windows 版游戏目录。应从最新 `dev` 建立独立分支，保留同步前的数据快照，更新记录才能正确比较前后版本。

### 1. 准备分支和依赖

```powershell
git fetch origin
git switch -c feature/sync-dove-data origin/dev
npm ci
```

### 2. 运行同步

将路径替换成你本机实际的 `KingdomRushDove` 目录：

```powershell
npm run sync:dove -- --game-dir "D:\你的游戏目录\KingdomRushDove"
```

同步器会读取游戏 Lua 模板、中文文本、百科、解锁表和图集，并自动更新：

- `src/data/dove-data.json`；
- `src/data/game-changelog.json`；
- `public/encyclopedia`、`public/skills`、`public/portraits`；
- `public/heroes`、`public/enemies`、`public/technologies`。

通常不需要单独运行 `npm run changelog:dove`，完整同步已经会生成更新记录。同一游戏提交重复同步也不会重复记录。

同步器默认在游戏目录上一级寻找 `lovec.exe`。如果文件在其他位置：

```powershell
npm run sync:dove -- --game-dir "D:\你的游戏目录\KingdomRushDove" --love-exe "D:\工具\lovec.exe"
```

### 3. 检查并提交

```powershell
git status --short
npm test
npm run build
```

检查生成结果时请重点确认：

- 输出的游戏版本和提交哈希符合预期；
- 塔、英雄、敌人、科技和图标数量没有异常下降；
- 解锁异常和无法折算的伤害项目已核对；
- 更新页中的新增、移除和数值变化符合游戏实际内容；
- 没有混入游戏安装文件、`tools/.tmp` 或其他无关文件。

生成的 JSON 和图片应由同步工具产生，不要为了“修正结果”直接手改。发现提取错误时，应修改同步逻辑并补充测试。

提交示例：

```powershell
git add src/data public/encyclopedia public/skills public/portraits public/heroes public/enemies public/technologies
git commit -m "chore: sync dove game data"
git push -u origin feature/sync-dove-data
```

然后创建目标为 `dev` 的 PR。数据 PR 合并后，由维护者决定何时运行数据发布工作流。

## 三个 GitHub Actions 工作流

普通贡献者只需确保 PR 的 CI 通过。后两个工作流会创建版本或部署网站，仅由维护者运行。

| 工作流 | 什么时候触发 | 做什么 | 是否发布 |
| --- | --- | --- | --- |
| **CI** | 向 `dev`、`main` 推送或提交 PR 时自动触发；也可在 Actions 页面手动运行 | 安装依赖、运行测试、构建 Pages 版本并检查产物 | 否 |
| **Publish synced game data** | 维护者在 Actions 页面手动运行，并输入未使用的 `vX.Y.Z` 版本号 | 用最新 `main` 代码叠加 `dev` 中的生成数据，测试后创建数据专用 Tag，并启动发布工作流 | 是 |
| **Release and deploy** | 推送 `v*` Tag 时自动触发；也可手动选择一个已有的 `v*` Tag 运行 | 校验 Tag、测试、构建、创建 GitHub Release，并部署 GitHub Pages | 是 |

### 手动运行 CI

1. 打开仓库 **Actions**；
2. 选择 **CI**；
3. 点击 **Run workflow**，选择需要检查的分支并运行。

### 只发布新版游戏数据

适用于站点代码没有变化，只有游戏数据更新的情况：

1. 将数据同步 PR 合并到 `dev`；
2. 确认 `dev` 已包含最新 `main`，并且 CI 通过；
3. 打开 **Actions → Publish synced game data → Run workflow**；
4. 输入一个未使用的稳定版本号，例如 `v1.3.3`；
5. 工作流会自动创建隔离的数据 Tag，并启动 **Release and deploy**。

此流程不会把 `dev` 中尚未发布的功能代码带到线上。站点代码取最新 `main`，只有生成数据和游戏资源取自 `dev`。

### 发布代码版本

1. 通过 PR 将准备发布的 `dev` 合入 `main`；
2. 确认 `main` 的 CI 通过；
3. 在 `main` 最新提交创建并推送稳定 SemVer Tag：

```powershell
git switch main
git pull --ff-only origin main
git tag -a v1.4.0 -m "Release v1.4.0"
git push origin v1.4.0
```

推送 Tag 后，**Release and deploy** 会自动创建 Release 并部署 Pages。手动运行该工作流时必须选择一个已有的 `v*` Tag；选择普通分支会校验失败。

## 开发共识

- 以游戏文件和游戏内百科为事实来源，不凭感觉补数值；发现冲突时在 Issue 或 PR 中列出来源和判断。
- 同步数据由工具生成；修改提取逻辑时补充能防止问题复发的测试。
- 一个 Issue、一个分支、一个 PR 尽量只解决一件事，不夹带无关重构或大规模格式化。
- 新增计算机制时写清公式、随机规则和未计算项，并为关键边界补测试。
- 界面改动同时检查桌面端和手机端，优先复用现有 shadcn 组件，并保证文字可读、控件不遮挡内容。
- 保持页面地址可刷新和可分享；新增主页面时同步更新导航和地址映射。
- 不提交密码、Token、私钥、个人信息或本机专用配置，不随意使用 `git push --force`。
- 对数据口径或功能方向不确定时先讨论，不要用难以回退的大改动替代沟通。

友善、具体的反馈比“完美的提交”更重要。欢迎从一个小问题、一条数据线索或一次文档改进开始。
