'use strict';
/**
 * Generates Windows cmd.exe-safe .bat launchers with strict UTF-8 no-BOM + CRLF (\r\n)
 * line endings, pure ASCII preamble before `chcp 65001 >nul`, goto labels instead of
 * parenthesized `if (...)` blocks, and escaped parentheses on echo lines.
 */
const fs = require('fs');
const path = require('path');

const SHINY_ROOT = path.resolve(__dirname, '..');

const batPlayer = [
  '@echo off',
  'setlocal',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  '',
  'echo ============================================================================',
  'echo   闪耀色彩 ^(ShinyColors^) 剧情播放器 · 浏览器与局域网便携端 ^(:18899^)',
  'echo   [轻量免打包资源模式] 首次使用可在左上角「资源挂载」指定外部 D:\\enza 目录',
  'echo ============================================================================',
  'echo.',
  '',
  'where node >nul 2>nul',
  'if errorlevel 1 goto :err_node',
  '',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start_player_detached.ps1" -BindHost 0.0.0.0 -Port 18899',
  'if errorlevel 1 goto :err_player',
  '',
  'echo.',
  'echo [就绪] 本地访问地址: http://127.0.0.1:18899/',
  'echo [提示] 同一 Wi-Fi 手机/平板可通过本机局域网 IP:18899 直接横屏观看！',
  'if /i "%SC_NO_BROWSER%"=="1" exit /b 0',
  'start "" "http://127.0.0.1:18899/"',
  'ping -n 2 127.0.0.1 >nul 2>nul',
  'exit /b 0',
  '',
  ':err_node',
  'echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 或使用 EXE 桌面版。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1',
  '',
  ':err_player',
  'echo.',
  'echo [错误] 启动播放器本地服务 ^(:18899^) 失败，请检查端口占用后重试。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1'
].join('\r\n') + '\r\n';

const batStudio = [
  '@echo off',
  'setlocal',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  '',
  'echo ============================================================================',
  'echo   闪耀色彩 ^(ShinyColors^) 二创制作器 Studio ^(:18898/proto/^) + 舞台引擎 ^(:18899^)',
  'echo   [双服务联动] 自动后台拉起 2D Spine 舞台播放器与 Studio 创作工作台',
  'echo ============================================================================',
  'echo.',
  '',
  'where node >nul 2>nul',
  'if errorlevel 1 goto :err_node',
  '',
  'echo [1/2] 正在确认/启动 Spine 舞台播放引擎 ^(:18899^)...',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start_player_detached.ps1" -Port 18899',
  'if errorlevel 1 goto :err_player',
  '',
  'echo [2/2] 正在确认/启动 二创制作器 Studio 服务 ^(:18898^)...',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start_studio_detached.ps1" -Port 18898',
  'if errorlevel 1 goto :err_studio',
  '',
  'echo.',
  'echo [就绪] Studio 创作台: http://127.0.0.1:18898/proto/',
  'echo [就绪] 独立剧情播放器: http://127.0.0.1:18899/',
  'if /i "%SC_NO_BROWSER%"=="1" exit /b 0',
  'start "" "http://127.0.0.1:18898/proto/"',
  'ping -n 2 127.0.0.1 >nul 2>nul',
  'exit /b 0',
  '',
  ':err_node',
  'echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 后再试。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1',
  '',
  ':err_player',
  'echo [错误] 舞台播放引擎 ^(:18899^) 启动失败。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1',
  '',
  ':err_studio',
  'echo [错误] 二创制作器 Studio ^(:18898^) 启动失败。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1'
].join('\r\n') + '\r\n';

const batRestartUpdate = [
  '@echo off',
  'setlocal',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  '',
  'echo ============================================================================',
  'echo   闪耀色彩 ^(ShinyColors^) Studio 覆盖更新重启器 ^(:18899 + :18898^)',
  'echo   [覆盖更新专用] 强制关闭旧版残留后台进程并重新拉起最新版双服务',
  'echo ============================================================================',
  'echo.',
  '',
  'where node >nul 2>nul',
  'if errorlevel 1 goto :err_node',
  '',
  'echo [1/2] 正在重启 Spine 舞台播放引擎 ^(:18899^)...',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start_player_detached.ps1" -Restart -Port 18899',
  'if errorlevel 1 goto :err_player',
  '',
  'echo [2/2] 正在重启 二创制作器 Studio 服务 ^(:18898^)...',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start_studio_detached.ps1" -Restart -Port 18898',
  'if errorlevel 1 goto :err_studio',
  '',
  'echo.',
  'echo [完成] 已加载最新版程序! Studio 地址: http://127.0.0.1:18898/proto/',
  'if /i "%SC_NO_BROWSER%"=="1" exit /b 0',
  'start "" "http://127.0.0.1:18898/proto/"',
  'ping -n 2 127.0.0.1 >nul 2>nul',
  'exit /b 0',
  '',
  ':err_node',
  'echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 后再试。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1',
  '',
  ':err_player',
  'echo [错误] 舞台播放引擎 ^(:18899^) 重启失败。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1',
  '',
  ':err_studio',
  'echo [错误] 二创制作器 Studio ^(:18898^) 重启失败。',
  'if not "%SC_NO_PAUSE%"=="1" pause',
  'exit /b 1'
].join('\r\n') + '\r\n';

for (const [name, content] of [
  ['启动_剧情播放器(浏览器+局域网版).bat', batPlayer],
  ['启动_二创制作器Studio.bat', batStudio],
  ['覆盖更新后点我_重启并启动Studio.bat', batRestartUpdate]
]) {
  const fp = path.join(SHINY_ROOT, name);
  fs.writeFileSync(fp, Buffer.from(content, 'utf8'));
  const buf = fs.readFileSync(fp);
  const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  let bareLf = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0A && (i === 0 || buf[i - 1] !== 0x0D)) bareLf++;
  }
  console.log(`${name}: bytes=${buf.length} hasBom=${hasBom} bareLf=${bareLf}`);
}
