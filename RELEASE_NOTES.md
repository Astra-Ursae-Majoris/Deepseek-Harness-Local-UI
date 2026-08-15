# Release Notes — v0.2.0

**DeepSeek Harness 本地桌面版（Deepseek-Harness-Local-UI）v0.2.0**

---

## 🎉 本版亮点

新增 **Python 启动器**（推荐方案）：纯 Python 实现、零依赖、可自编译 EXE——**彻底绕开 SmartScreen「无法验证发布者」问题**（自己编译的 EXE 不会触发该拦截）。

## 📦 使用方式

### 方式一：Python 启动器（推荐）

```bash
# 0. 准备：Node.js ≥ 22.19 + pnpm ≥ 9 + Python ≥ 3.10
# 1. 安装 DSH 依赖（只需一次）
cd harness && pnpm install
echo DEEPSEEK_API_KEY=你的密钥 > harness/.env

# 2. 运行启动器（图形界面）
python desktop-py/dsh_launcher.py
# 点「🚀 启动服务」→「🌐 打开界面」
```

### 方式二：自编译 EXE（可选）

```bash
cd desktop-py
build_exe.bat    # 在自己电脑上编译，产物：dist/DSH-Desktop-Python.exe
```

自己编译的 EXE **不会**出现「无法验证发布者」提示，双击即用。

### 方式三：Electron 桌面壳（可选，源码保留）

`src/` 目录保留 Electron 桌面壳源码，需自行 `npm install && npm run build`。对外分发 Electron EXE 需要商业代码签名证书。

## ✨ 功能特性

### 🐍 Python 启动器

- 纯 Python 标准库 + tkinter，**零第三方依赖**；
- 一键 启动 / 停止 / 重启 DSH 服务，实时状态显示；
- 一键打开系统浏览器访问 GUI；
- 自动检测 DSH 目录（`DSH_HOME` → 同级 `harness/` → 手动选择）；
- 设置记忆、中文界面、日志输出。

### 🔍 修改版 Web GUI 增强

- **对话大纲导航栏**：右侧常驻目录，完整加载全部轮次（首句摘要），点击定位 + 高亮；窗口过窄自动收起；
- **回退到这一步** / **重新生成**：用户消息悬浮按钮，一键 fork 分支或重发；
- 新增 `session.outline` 服务端 RPC。

### 🖥 Electron 桌面壳（可选）

- 原生窗口、右键手势、快捷键屏蔽、文件拖放、托盘常驻、模型/密钥管理窗口。

## 🧩 与上游的关系

- 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方提交 `f98a57e` 二次开发；
- 官方源码占比 ≈ **99.75%**（≈ 742,000 行），本仓库修改净增 ≈ **0.25%**（≈ 1,845 行），Python 启动器 / 桌面壳为独立新增代码；
- 全部代码遵循 **MIT License**：上游版权 © 2026 DeepSeek，修改与新增代码版权 © 2026 Astra-Ursae-Majoris；
- 详细占比、改动清单与法律声明见仓库 [NOTICE.md](NOTICE.md)。

## 🔒 安全说明

- 服务仅绑定 `127.0.0.1`，不对局域网开放；
- API 密钥不落盘、不上传，仅读取环境变量 / `.env`；
- 停止服务时整棵进程树终止。

## ❓ 常见问题

- **SmartScreen 提示「无法验证发布者」？** → 用 Python 启动器（`python desktop-py/dsh_launcher.py`）或自编译 EXE（`build_exe.bat`），不会触发该提示；
- **找不到 DSH 目录？** → 启动器里点「更改 DSH 目录…」选择 `harness/`；
- **端口被占用？** → 点「重启服务」自动接管；
- **服务重启后对话会丢吗？** → 不会，数据持久化在会话存储中。

## ⚖️ 免责声明

本项目与 DeepSeek 公司无任何隶属、背书或合作关系；按 MIT 协议以「AS IS」提供，不附带任何担保。

---

**欢迎 Star ⭐ / Issue / Fork。**
