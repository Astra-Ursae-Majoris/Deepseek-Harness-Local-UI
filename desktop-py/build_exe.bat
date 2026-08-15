@echo off
chcp 65001 >nul
title DeepSeek Harness 桌面版 - 自编译 EXE
echo.
echo ============================================================
echo    DeepSeek Harness 桌面版 - 在您自己电脑上编译 EXE
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo   未找到 Python，请先安装 Python 3.10+ 并勾选 "Add to PATH"
  echo   下载: https://www.python.org/downloads/
  pause
  exit /b 1
)
python --version

echo.
echo [2/4] 安装 PyInstaller 与 pywebview...
python -m pip install --upgrade pyinstaller pywebview
if errorlevel 1 (
  echo   安装失败，请检查网络后重试
  pause
  exit /b 1
)

echo.
echo [3/4] 请选择要编译的版本：
echo   1 - 纯 Python 启动器（tkinter，零依赖，最小）
echo   2 - WebView 窗口版（加载 DSH Web GUI）
echo   3 - 全量 UI 桌面版（推荐：自绘聊天界面 + 大纲导航 + 服务管家）
set /p MODE=请输入 1 / 2 / 3（默认 3）: 
if "%MODE%"=="1" (
  python -m PyInstaller --onefile --windowed --name DSH-Desktop-Python dsh_launcher.py
) else if "%MODE%"=="2" (
  python -m PyInstaller --onefile --windowed --name DSH-Desktop-Python ^
    --collect-all webview --collect-all pywebview ^
    --add-data "%~dp0dsh_launcher.py;." ^
    dsh_webview.py
) else (
  python -m PyInstaller --onefile --windowed --name DSH-Desktop ^
    --collect-all webview --collect-all pywebview ^
    --add-data "%~dp0dsh_api.py;." ^
    --add-data "%~dp0dsh_ui;dsh_ui" ^
    dsh_app.py
)

if errorlevel 1 (
  echo   编译失败，请检查上方错误信息
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   编译成功！
if "%MODE%"=="3" (echo   EXE 位于: %~dp0dist\DSH-Desktop.exe) else (echo   EXE 位于: %~dp0dist\DSH-Desktop-Python.exe)
echo   自己编译的 EXE 不会被 Windows SmartScreen 拦截，双击即用。
echo ============================================================
echo.
pause
