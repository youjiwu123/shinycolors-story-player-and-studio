@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================================
echo   闪耀色彩 ^(ShinyColors^) Studio 覆盖更新重启器 ^(:18899 + :18898^)
echo   [覆盖更新专用] 强制关闭旧版残留后台进程并重新拉起最新版双服务
echo ============================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :err_node

echo [1/2] 正在重启 Spine 舞台播放引擎 ^(:18899^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start_player_detached.ps1" -Restart -Port 18899
if errorlevel 1 goto :err_player

echo [2/2] 正在重启 二创制作器 Studio 服务 ^(:18898^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start_studio_detached.ps1" -Restart -Port 18898
if errorlevel 1 goto :err_studio

echo.
echo [完成] 已加载最新版程序! Studio 地址: http://127.0.0.1:18898/proto/
if /i "%SC_NO_BROWSER%"=="1" exit /b 0
start "" "http://127.0.0.1:18898/proto/"
ping -n 2 127.0.0.1 >nul 2>nul
exit /b 0

:err_node
echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 后再试。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1

:err_player
echo [错误] 舞台播放引擎 ^(:18899^) 重启失败。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1

:err_studio
echo [错误] 二创制作器 Studio ^(:18898^) 重启失败。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1
