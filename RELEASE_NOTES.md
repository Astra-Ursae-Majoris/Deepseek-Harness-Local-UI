# Release Notes — v0.3.0

**DeepSeek Harness 本地桌面版（Deepseek-Harness-Local-UI）v0.3.0**

---

## 🎉 本版亮点

新增 **Python 全量 UI 桌面版**（`desktop-py/dsh_app.py`）：用 Python 自绘的完整聊天应用，包含我们讨论过的全部功能——**对话大纲导航、回退到这一步、重新生成、流式回复、服务管家**，全部在一个原生窗口里，不依赖浏览器、不需要 Electron。

## ✨ 全量 UI 桌面版功能

- 💬 **完整聊天界面**：左侧会话列表 + 中间消息流 + 底部输入框（Enter 发送 / Shift+Enter 换行），回复流式打字机显示；
- 🗂 **对话大纲导航栏**：右侧常驻目录，完整加载全部轮次（首句摘要），点击任意轮次定位消息 + 高亮，支持收起；
- ↩️ **回退到这一步**：用户消息悬浮按钮，在该轮之前 fork 分支并打开子会话；
- 🔄 **重新生成**：fork 后自动重发原消息；
- 🚀 **服务管家**：顶栏一键 启动 / 停止 / 重启服务，实时状态 + 版本显示；
- 📡 **实时事件流**：SSE 接收会话事件，流式回复实时刷新；
- 🔨 **自编译 EXE**：`build_exe.bat` 选 3，在自己电脑上编译（约 48MB），**无 SmartScreen 拦截**。

## 📦 使用方式

### 方式一：Python 全量 UI（推荐）

```bash
# 准备：Node.js ≥ 22.19 + pnpm ≥ 9 + Python ≥ 3.10
cd harness && pnpm install        # DSH 依赖（一次）
echo DEEPSEEK_API_KEY=你的密钥 > harness/.env
pip install pywebview             # 一次
python desktop-py/dsh_app.py      # 启动全量 UI 桌面版
```

### 方式二：自编译 EXE

```bash
cd desktop-py
build_exe.bat   # 选 3 → dist/DSH-Desktop.exe（约 48MB，自己编译不被 SmartScreen 拦截）
```

### 方式三：轻量启动器 / WebView / Electron

- `python desktop-py/dsh_launcher.py` — 零依赖轻量启动器（浏览器打开）；
- `python desktop-py/dsh_webview.py` — WebView 窗口版；
- Electron 桌面壳源码保留在 `src/`（可选，自行构建）。

## 🧩 与上游的关系

- 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方提交 `f98a57e` 二次开发；
- 官方源码占比 ≈ **99.75%**（≈ 742,000 行），本仓库修改净增 ≈ **0.25%**（≈ 1,845 行），Python 客户端 / 桌面壳为独立新增代码；
- 全部代码遵循 **MIT License**：上游版权 © 2026 DeepSeek，修改与新增代码版权 © 2026 Astra-Ursae-Majoris；
- 详细占比、改动清单与法律声明见仓库 [NOTICE.md](NOTICE.md)。

## 🔒 安全说明

- 服务仅绑定 `127.0.0.1`，不对局域网开放；
- API 密钥不落盘、不上传，仅读取环境变量 / `.env`；
- 停止服务时整棵进程树终止。

## ⚖️ 免责声明

本项目与 DeepSeek 公司无任何隶属、背书或合作关系；按 MIT 协议以「AS IS」提供，不附带任何担保。

---

**欢迎 Star ⭐ / Issue / Fork。**
