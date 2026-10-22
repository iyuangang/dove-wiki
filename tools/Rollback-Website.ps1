[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$')][string]$Version,[switch]$DryRun)
$ErrorActionPreference='Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $release=gh release view $Version --json tagName,assets | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $release.tagName -ne $Version) { throw '未找到指定正式版本' }
    foreach ($name in @("dove-wiki-$Version.zip","dove-wiki-$Version.zip.sha256")) { if ($release.assets.name -notcontains $name) { throw "版本缺少附件：$name" } }
    if ($DryRun) { Write-Host "可回退至 $Version；正式执行将校验该版本 ZIP 后重新部署。";return }
    gh workflow run rollback-site.yml --ref main -f "version=$Version"
    if ($LASTEXITCODE -ne 0) { throw '未能启动网站回退，请检查 GitHub Actions' }
    Write-Host "已请求回退至 $Version，请在 Actions 查看部署结果。Git 分支和版本标签保持原记录。"
} finally { Pop-Location }
