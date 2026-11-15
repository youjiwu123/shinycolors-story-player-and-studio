@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================================
echo   闪耀色彩 ^(ShinyColors^) 剧情播放器 · 浏览器与局域网便携端 ^(:18899^)
echo   [轻量免打包资源模式] 首次使用可在左上角「资源挂载」指定外部 D:\enza 目录
echo ============================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :err_node

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start_player_detached.ps1" -BindHost 0.0.0.0 -Port 18899
if errorlevel 1 goto :err_player

echo.
echo [就绪] 本地访问地址: http://127.0.0.1:18899/
echo [提示] 同一 Wi-Fi 手机/平板可通过本机局域网 IP:18899 直接横屏观看！
if /i "%SC_NO_BROWSER%"=="1" exit /b 0
start "" "http://127.0.0.1:18899/"
ping -n 2 127.0.0.1 >nul 2>nul
exit /b 0

:err_node
echo [错误] 未检测到 Node.js 运行环境，请先安装 Node.js ^(>= 18^) 或使用 EXE 桌面版。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1

:err_player
echo.
echo [错误] 启动播放器本地服务 ^(:18899^) 失败，请检查端口占用后重试。
if not "%SC_NO_PAUSE%"=="1" pause
exit /b 1
