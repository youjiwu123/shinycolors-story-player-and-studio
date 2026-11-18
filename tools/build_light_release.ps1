param(
  [string]$OutRoot = "",
  [switch]$CreateZip
)

<#
  build_light_release.ps1
  轻量免重资源发行打包脚本（遵循「只保留剧情元数据索引，重资源外部挂载」架构）：
    - 仅打包播放器/Studio 代码、轻量级剧情目录快照 (catalog_meta_snapshot.json)、
      中文化标题索引、动画白名单、SCSP 精选双语还原剧目、polisher 30人校准核、
      Studio 语义索引、Schema、示例 .scpack 二创包、
      Electron app 壳 (desktop/main.js + desktop/app/) 以及一键启动 .bat。
    - 严禁复制 D:\enza (18GB+) 或 D:\SCSPDownloader 重型媒体本体！
    - 严禁修改只读目录 projects/shinycolors/desktop/dist/！
#>

$ErrorActionPreference = 'Stop'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ShinyRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutRoot) {
  $OutRoot = Join-Path $ShinyRoot 'output\light-release'
}

$PkgName = 'ShinyColors-Player-Studio-Light'
$StageDir = Join-Path $OutRoot $PkgName

# 安全护栏：决不允许目标路径指向只读源目录
$ForbiddenTargets = @('D:\enza', 'D:\SCSPDownloader', (Join-Path $ShinyRoot 'desktop\dist'), (Join-Path $ShinyRoot 'desktop\release-full'))
foreach ($fb in $ForbiddenTargets) {
  if ($StageDir.ToLower().StartsWith($fb.ToLower())) {
    throw "Refusing to write into read-only protected path: $fb"
  }
}

# 先同步最新播放器代码到 desktop/app
$SyncScript = Join-Path $PSScriptRoot 'sync_desktop.ps1'
if (Test-Path $SyncScript) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $SyncScript -Apply | Out-Null
}

if (Test-Path $StageDir) {
  Remove-Item -Recurse -Force $StageDir
}
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

function Copy-RelFile([string]$RelPath) {
  $src = Join-Path $ShinyRoot $RelPath
  if (-not (Test-Path $src)) { return }
  $dst = Join-Path $StageDir $RelPath
  $parent = Split-Path -Parent $dst
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

function Copy-RelDir([string]$RelDir, [string[]]$ExcludeNames = @()) {
  $src = Join-Path $ShinyRoot $RelDir
  if (-not (Test-Path $src)) { return }
  $dst = Join-Path $StageDir $RelDir
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
    if ($ExcludeNames -contains $_.Name) { return }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Recurse -Force
  }
}

# 1. 顶层入口与一键启动器（保持原样 UTF-8 无 BOM + CRLF 字节流）
Copy-RelFile '启动_剧情播放器(浏览器+局域网版).bat'
Copy-RelFile '启动_二创制作器Studio.bat'
Copy-RelFile '覆盖更新后点我_重启并启动Studio.bat'
Copy-RelFile 'editor.html'
Copy-RelFile 'editor.css'
Copy-RelFile 'editor.js'

# 2. 核心播放器服务端与前端 + 皮肤画廊静态页
Copy-RelFile 'tmp\enza-server.js'
Copy-RelFile 'tmp\enza-player.html'
Copy-RelDir 'ui-mockups' @()

# 3. 轻量级剧情与资源元数据索引 + Studio 润色核/语义库/Schema（零重媒体本体！）
$LightDataFiles = @(
  'data\catalog_meta_snapshot.json',
  'data\story_title_zh.json',
  'data\anim_whitelist.json',
  'data\bg_visual_index.json',
  'data\scsp_curated_stories.json',
  'data\story_master.json',
  'studio\lib\polisher-core.js',
  'studio\lib\polisher-cards-v1.json',
  'studio\data\asset_semantics.json',
  'studio\data\idol_outfits.json',
  'studio\data\bg_visual_index.json',
  'studio\data\aizuchi_index.json',
  'studio\data\char_anim_combos.json',
  'studio\data\scene_macros.json',
  'studio\data\readings.toml',
  'studio\data\spine_anim_metrics.json',
  'studio\tools\story_era_map.json',
  'studio\tools\contact_sheets\bg_visual_index.json',
  'tools\cache\anim_whitelist.json',
  'schema\official_script.schema.json',
  'schema\scproj.schema.json'
)
foreach ($df in $LightDataFiles) {
  Copy-RelFile $df
}

# 4. Studio 二创工作台前端与引擎 + 示例轻量工程包 + 预置工作区工程（过滤测试残留且严禁携带任何密钥/凭据文件）
Copy-RelDir 'studio-proto' @('node_modules', '.git', '.llm-local.json', '.tts-local.json', '.vertex-sa.json', '.env', 'secrets')
Get-ChildItem -LiteralPath (Join-Path $StageDir 'studio-proto') -Force -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match '^\.(llm-local|tts-local|vertex-sa|env)|\.sa\.json$'
} | Remove-Item -Force -ErrorAction SilentlyContinue
Copy-RelDir 'examples\scproj' @()
$wsSrc = Join-Path $ShinyRoot 'projects_workspace'
$wsDst = Join-Path $StageDir 'projects_workspace'
New-Item -ItemType Directory -Path $wsDst -Force | Out-Null
if (Test-Path $wsSrc) {
  Get-ChildItem -LiteralPath $wsSrc -Force | Where-Object {
    $_.Name -notmatch '^(1\.scpack|.*_imp_.*|proj_mw.*|test_.*|vp_.*)$'
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $wsDst $_.Name) -Recurse -Force
  }
}
New-Item -ItemType Directory -Path (Join-Path $StageDir 'user_imports') -Force | Out-Null

# 5. 启动、同步、打包与云端部署脚本
$ToolFiles = @(
  'tools\start_player_detached.ps1',
  'tools\start_studio_detached.ps1',
  'tools\studio_portable_server.js',
  'tools\sync_desktop.ps1',
  'tools\build_light_release.ps1',
  'tools\build_portable_bats.js'
)
foreach ($tf in $ToolFiles) {
  Copy-RelFile $tf
}
Copy-RelDir 'deploy' @()

# 6. 轻量级运行时 npm 依赖（仅 js-yaml / ajv / adm-zip，保证 .scs.yaml 解析与校验免 npm install 开箱即用）
$RuntimeNpmPkgs = @('js-yaml', 'argparse', 'ajv', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string', 'adm-zip')
foreach ($pkg in $RuntimeNpmPkgs) {
  Copy-RelDir ("desktop\node_modules\$pkg") @()
}

# 7. Electron 桌面端轻量壳代码与完整运行清单（不含 Electron 大体积二进制）
$DesktopFiles = @(
  'desktop\main.js',
  'desktop\preload.js',
  'desktop\updater.js',
  'desktop\package.json',
  'desktop\app\app-manifest.json',
  'desktop\app\main-app.js',
  'desktop\app\server.js',
  'desktop\app\player.html',
  'desktop\app\version.json',
  'desktop\app\icon.ico',
  'desktop\app\data\name.csv'
)
foreach ($dk in $DesktopFiles) {
  Copy-RelFile $dk
}

# 覆盖更新保护：写入 .example 示例配置，不覆盖老用户已写好的 desktop\data-path.txt 或 data\mount-config.json
$DataPathSample = @(
  '# 闪耀色彩播放器外部资源目录配置示例（免打包资源分发模式）',
  '# 如需手动固定路径，可复制本文件为 desktop\data-path.txt 并取消下面路径注释；',
  '# 也可直接在页面右上角「📂 资源挂载」弹窗中可视化选择目录并热重载（将保存为 data\mount-config.json）。',
  '# D:\enza'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $StageDir 'desktop\data-path.example.txt'), ($DataPathSample + "`r`n"), $Utf8NoBom)

$MountCfgSample = (@{
  enzaRoot = 'D:\enza'
  scspRoot = 'D:\SCSPDownloader'
  note = '示例文件：在界面点击「📂 资源挂载」后会自动生成实际的 data/mount-config.json，覆盖更新不会覆盖您的本机配置'
} | ConvertTo-Json -Depth 3) + "`r`n"
[System.IO.File]::WriteAllText((Join-Path $StageDir 'data\mount-config.example.json'), $MountCfgSample, $Utf8NoBom)

# 8. 发行包与覆盖更新使用说明
$ReadmeText = (@(
  '========================================================================',
  '  闪耀色彩 (ShinyColors) 二创制作器 Studio & 播放器 · 完整代码/数据更新包（不含重资源）',
  '========================================================================',
  '',
  '【一、已安装过任意旧版本的用户 —— 覆盖更新步骤】',
  '  1. 将本压缩包内的全部文件/文件夹，直接解压覆盖到您原有的程序根目录',
  '    （即包含 tmp\、tools\、studio-proto\、data\ 的那一层文件夹，选择「替换所有目标文件」）。',
  '  2. 请放心覆盖：',
  '     • 本更新包不含 data\mount-config.json / desktop\data-path.txt / .llm-local.json 等用户配置，',
  '       您原本配置好的 D:\enza / E:\enza 资源路径、本地 AI 密钥与自建工程均会保留！',
  '     • 若您曾经运行过旧版后台服务，请直接双击「覆盖更新后点我_重启并启动Studio.bat」，',
  '       它会自动关闭旧版残留进程并拉起最新版 Studio (:18898/proto/) 与舞台引擎 (:18899)。',
  '  3. 若您此前使用的是 Electron 独立 EXE 桌面版（仅播放器），可将本包内的',
  '     desktop\app\* 覆盖到 EXE 安装目录的 resources\app\ 下即可完成播放器内核升级。',
  '',
  '【二、首次使用本便携包的用户（只需另备官方重资源目录）】',
  '  1. 环境准备：需提前安装 Node.js (>= 18) 与您本机的 enza 资源目录（及可选 SCSPDownloader）。',
  '  2. 双击「启动_二创制作器Studio.bat」（打开 Studio 工作台 http://127.0.0.1:18898/proto/）',
  '     或「启动_剧情播放器(浏览器+局域网版).bat」（打开独立播放器 http://127.0.0.1:18899/）。',
  '  3. 打开后若未自动识别到 D:\enza，请在右上角「📂 资源挂载」选择您本机的 enza / SCSP 目录，',
  '     点击「保存并热重载挂载」即刻点亮全量官方剧情、Spine 立绘、背景 CG 与语音！',
  '',
  '【架构说明：为何不含重资源本体】',
  '  本包内置完整编辑器前端/后端、65 种全量面部表情与动作库、28/30 人润色与 OOC 校准核、',
  '  10,941 话官方剧情快照、中文化标题、服装白名单与运行时依赖（含 js-yaml / ajv），',
  '  不捆绑 18GB+ 的贴图/语音重资源，方便秒速传播与无痛覆盖升级。'
) -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText((Join-Path $StageDir 'README_外部资源挂载说明.txt'), $ReadmeText, $Utf8NoBom)

$allFiles = Get-ChildItem -LiteralPath $StageDir -Recurse -File
$leakedSecrets = $allFiles | Where-Object { $_.Name -match '^\.(llm-local|tts-local|vertex-sa|env)|\.sa\.json$' }
if ($leakedSecrets) {
  throw ("Refusing to build release containing secret files: " + (($leakedSecrets | ForEach-Object { $_.FullName }) -join ', '))
}
$totalBytes = ($allFiles | Measure-Object -Property Length -Sum).Sum
$totalMB = [Math]::Round($totalBytes / 1MB, 2)

$zipPath = ""
if ($CreateZip) {
  $zipPath = Join-Path $OutRoot ($PkgName + '.zip')
  if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
  Compress-Archive -Path (Join-Path $StageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
}

$manifest = [ordered]@{
  packageName = $PkgName
  generatedAt = (Get-Date).ToString('o')
  stageDir = $StageDir
  zipPath = $zipPath
  fileCount = $allFiles.Count
  totalBytes = $totalBytes
  totalMB = $totalMB
  zeroHeavyAssetsBundled = $true
}
$manifestJson = ($manifest | ConvertTo-Json -Depth 4) + "`r`n"
[System.IO.File]::WriteAllText((Join-Path $OutRoot 'light-release-manifest.json'), $manifestJson, $Utf8NoBom)

Write-Output "LIGHT_RELEASE_OK FILES=$($allFiles.Count) SIZE_MB=$totalMB DIR=$StageDir"
