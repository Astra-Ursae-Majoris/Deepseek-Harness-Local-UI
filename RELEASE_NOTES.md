# Release Notes — v0.3.1

**DeepSeek Harness 本地桌面版（Deepseek-Harness-Local-UI）v0.3.1**

---

## 🎉 本版亮点

**Python 完整版桌面应用**：Python 主程序 + 原生窗口加载**完整 DSH Web GUI**——界面效果与原版浏览器完全一致（Markdown 渲染、代码高亮、工具卡片、流式回复），并包含修改版的全部增强功能（**对话大纲导航、回退到这一步、重新生成**）。Python 负责服务管理、系统托盘、自动启动，PyInstaller 自编译 EXE 无 SmartScreen 拦截。

## ✨ 功能

- 🖥 **原生窗口 + 完整 Web GUI**：三栏布局（工作区 / 聊天 / 对话大纲导航），与原版浏览器体验完全一致；
- 🗂 **对话大纲导航**：完整加载全部轮次（首句摘要），点击定位 + 高亮，可收起；
- ↩️ **回退到这一步 / 🔄 重新生成**：用户消息悬浮按钮，一键 fork 分支；
- 🚀 **服务管家（Python 侧）**：自动检测 harness 并启动服务；
- 🪟 **系统托盘常驻**：关窗不退出（隐藏到托盘），托盘菜单：显示窗口 / 启动服务 / 停止服务 / 退出；
- 🔨 **自编译 EXE**：`build_exe.bat` 选 3（约 65MB），自己编译无 SmartScreen 拦截。

## 📦 使用方式

```bash
# 准备：Node.js ≥ 22.19 + pnpm ≥ 9 + Python ≥ 3.10
cd harness && pnpm install
echo DEEPSEEK_API_KEY=你的密钥 > harness/.env

# 方式一：直接运行（Python）
pip install pywebview pystray pillow
python desktop-py/dsh_app.py

# 方式二：自编译 EXE
cd desktop-py && build_exe.bat   # 选 3 → dist/DSH-Desktop.exe
```

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
