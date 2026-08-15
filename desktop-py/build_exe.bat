@echo off
chcp 65001 >nul
title DeepSeek Harness 桌面版 - 自编译 EXE
echo.
echo ============================================================
echo    DeepSeek Harness 桌面版 - 在您自己电脑上编译 EXE
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo   未找到 Python，请先安装 Python 3.10+ 并勾选 "Add to PATH"
  echo   下载: https://www.python.org/downloads/
  pause
  exit /b 1
)
python --version

echo.
echo [2/3] 安装 PyInstaller...
python -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo   PyInstaller 安装失败，请检查网络后重试
  pause
  exit /b 1
)

echo.
echo [3/3] 编译为 EXE（首次约 1-2 分钟）...
echo   请选择要编译的版本：
echo   1 - 纯 Python 启动器（推荐，无额外依赖，体积小）
echo   2 - WebView 桌面窗口版（需要 pip install pywebview）
set /p MODE=请输入 1 或 2（默认 1）: 
if "%MODE%"=="2" (
  echo   安装 pywebview...
  python -m pip install pywebview
  python -m PyInstaller --onefile --windowed --name DSH-Desktop-Python ^
    --collect-all webview --collect-all pywebview ^
    --add-data "dsh_launcher.py;." ^
    dsh_webview.py
) else (
  python -m PyInstaller --onefile --windowed --name DSH-Desktop-Python ^
    dsh_launcher.py
)

if errorlevel 1 (
  echo   编译失败，请检查上方错误信息
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   编译成功！EXE 位于: %~dp0dist\DSH-Desktop-Python.exe
echo   自己编译的 EXE 不会被 Windows SmartScreen 拦截，双击即用。
echo ============================================================
echo.
pause
