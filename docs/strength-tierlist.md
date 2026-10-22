# 强度天梯数据维护

页面地址：`#/tierlist`。百科和天梯分别标注来源版本，快速、标准两档独立维护。英雄近战与远程分组，常规塔按最终／过渡阶级分组；特殊对象列为附录，失败对象不评级。数量从测评批次读取。

## 推荐流程

现在可在后台测评完成并启用基准后，直接在 wiki 运行 `.\Update-And-Publish.cmd`，同步天梯、百科并等待网站发布。未启用基准时使用 `--run-directory "完整批次目录"`。详见[一键同步与发布](publish-updates.md)。下面保留单独导入和手动维护步骤。

在强度测评中心插件目录完成：

```powershell
.\Run-Native-Quick.cmd -NewRun -UseAsBaseline -Profile standard
```

到wiki目录运行：

```powershell
npm run ratings:sync -- --profile standard --publish
npm test
npm run build
git add data/asset-lock.json src/data/rating-manifest.json src/data/rating-methodology.json
```

工具读取 `%APPDATA%\LOVE\kingdom_rush_dove\Meta_Rating_Center\baselines\standard.json`，校验个人基准的摘要，定位其完整原生测评目录。快速档使用 `--profile quick`，不会覆盖另一档。`--publish` 将生成资源包上传到同仓库GitHub Releases，需要登录 `gh auth login`；不加该选项可先本地检查，再用 `npm run assets:publish -- ratings` 上传。

仅上传资源包不部署网站。提交上述小文件后，按仓库已有CI和发布流程上线。

## 指定来源

没有使用本机默认存档时，可指定个人基准目录或完整批次文件夹：

```powershell
npm run ratings:sync -- --profile standard --baseline-dir "D:\存档\Meta_Rating_Center\baselines" --publish
npm run ratings:sync -- --standard "D:\测评结果\standard_某批次" --methods "D:\测评标准与局限.md" --publish
```

也可以同时传 `--standard` 和 `--quick`，一次导入两档。请保留完整批次的JSON、raw目录、CSV、天梯PNG和测评标准。新批次与旧版独立参照均支持；缺少正式对象、轮次或分数不能复算时拒绝发布。导入在独立目录完成，核验成功后一次替换，失败回滚。

## 数据如何进入CI/CD

- `src/data/rating-manifest.json`：两档的版本、批次、数量、结果摘要；`rating-methodology.json` 保存页面说明。
- `data/asset-lock.json`：内容寻址资源包及SHA-256。
- GitHub Releases的 `data-assets`：不可覆盖同名内容的游戏图片包与天梯附件包；旧包保留，旧清单仍可还原。
- `public/rating`：构建前自动还原，包含结果、CSV、各组PNG、原始证据JSON.gz，Git忽略这些生成文件。

原始JSON按精确字节压缩，保留压缩前后校验值。页面按需读取本档结果并校验，切换时取消旧请求；数据缺失或不匹配时不生成等级。所有资源尊重站点部署的基路径。

更新百科图片后使用 `npm run assets:pack -- game` 和 `npm run assets:publish -- game`，再提交游戏数据JSON及资源清单。下载缓存位于 `tools/.tmp/asset-cache`；`npm run assets:restore -- --force` 可按当前清单强制还原。
