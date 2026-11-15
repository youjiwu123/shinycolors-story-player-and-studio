@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================================
echo   闪耀色彩 ^(ShinyColors^) 二创制作器 Studio ^(:18898/proto/^) + 舞台引擎 ^(:18899^)
echo   [双服务联动] 自动后台拉起 2D Spine 舞台播放器与 Studio 创作工作台
echo ============================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :err_node

echo [1/2] 正在确认/启动 Spine 舞台播放引擎 ^(:18899^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start_player_detached.ps1" -Port 18899
if errorlevel 1 goto :err_player

echo [2/2] 正在确认/启动 二创制作器 Studio 服务 ^(:18898^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start_studio_detached.ps1" -Port 18898
if errorlevel 1 goto :err_studio

echo.
echo [就绪] Studio 创作台: http://127.0.0.1:18898/proto/
echo [就绪] 独立剧情播放器: http://127.0.0.1:18899/
if /i "%SC_NO_BROWSER%"=="1" exit /b 0
start "" "http://127.0.0.1:18898/proto/"
ping -n 2 127.0.0.1 >nul 2>nul
exit /b 0

:err_node
echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 后再试。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1

:err_player
echo [错误] 舞台播放引擎 ^(:18899^) 启动失败。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1

:err_studio
echo [错误] 二创制作器 Studio ^(:18898^) 启动失败。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1
