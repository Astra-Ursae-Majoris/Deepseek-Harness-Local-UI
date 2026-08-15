# NOTICE — 代码来源、占比与改动声明

本文件说明 Deepseek-Harness-Local-UI 的代码构成、来源占比与修改声明，依据 MIT 开源协议的要求与惯例编写。

## 1. 上游项目

- **项目名称**：DeepSeek Harness
- **上游地址**：https://github.com/deepseek-ai/deepseek-harness
- **上游许可证**：MIT License，Copyright (c) 2026 DeepSeek（原文见 `harness/LICENSE`，原样保留）
- **上游文档**：`harness/README.md`、`harness/THIRD_PARTY_NOTICES.md`

## 2. 代码占比

按行数统计（由仓库提交历史核算）：

| 构成 | 规模 | 占比 |
| --- | --- | --- |
| DeepSeek Harness 官方源码（`harness/`，提交 f98a57e 基线） | ≈ 742,000 行 | ≈ 99.75% |
| 本仓库对上游的修改（44 个文件，净增 ≈ 1,845 行） | ≈ 1,845 行 | ≈ 0.25% |
| Python 启动器 / WebView 窗口版（`desktop-py/`，本仓库原创） | ≈ 500 行 | 独立新增 |
| Electron 桌面壳（`src/`、`scripts/`、`tests/`，本仓库原创） | ≈ 2,500 行 | 独立新增 |

> 说明：桌面壳与启动器为独立新增代码，不计入上游占比；表中「占比」仅就 `harness/` 目录内的上游代码与修改计算。

## 3. 修改声明

本仓库在 DeepSeek Harness 官方基线（commit `f98a57e`，`chore: full source baseline`）之上进行了以下修改：

### 3.1 Web GUI 增强（`harness/packages/client/ui-conversation/` 等）

1. **对话大纲导航栏**：右侧常驻目录面板，完整加载全部对话轮次（每轮显示首句摘要），点击任意轮次即可定位到对应消息位置；窗口过窄时自动收起为窄条；可手动收起/展开。
2. **回退到这一步**：用户消息悬浮按钮，在指定轮次之前创建会话分支（fork）并打开子会话。
3. **重新生成**：用户消息悬浮按钮，在指定轮次之前创建分支并自动重发原消息。
4. **大纲服务端接口**：新增 `session.outline` RPC（`harness/packages/host/apiproxy/`），返回整份会话日志的逐轮摘要，与客户端窗口加载无关。

### 3.2 Python 启动器与桌面壳（仓库根目录，原创）

1. **Python 启动器（推荐）**：`desktop-py/dsh_launcher.py`，纯 Python 标准库 + tkinter 实现，零第三方依赖；一键启动/停止/重启 DSH 服务、实时状态检测、一键打开浏览器；自带 `build_exe.bat` 可自编译为独立 EXE（自己编译的 EXE 不会被 Windows SmartScreen 拦截）。
2. **WebView 窗口版（可选）**：`desktop-py/dsh_webview.py`，基于 pywebview 把 Web GUI 装进原生窗口。
3. Electron 桌面壳（可选）：加载本地 DSH Web GUI（仅允许 `127.0.0.1` 白名单地址），屏蔽浏览器快捷键与手势干扰。
2. 服务管家：一键启动/停止/重启 DSH 服务，实时状态探测与通知；托盘常驻，「保持服务后台运行并退出」时服务进程独立于应用存活。
3. 右键手势：按住右键左右拖动 = 收起/展开侧边栏；Alt+←/→ 同效。
4. 文件拖放：拖入图片等文件与浏览器行为一致，且可获得真实文件路径。
5. 模型/API 密钥管理窗口（读取系统环境变量，应用不存储密钥）。

## 4. 许可与法律说明

- 本项目整体遵循 **MIT License**（全文见 `LICENSE`），版权声明同时保留上游（DeepSeek）与本仓库修改者。
- `harness/` 目录内的上游代码版权归 DeepSeek 所有，本仓库未改变其许可证文本。
- 按 MIT 协议，本软件按「AS IS」提供，不附带任何明示或默示的担保；作者与版权持有人不对任何索赔、损害或其他责任负责。
- 本项目与 DeepSeek 公司及其关联方**无任何隶属、背书或合作关系**；「DeepSeek」等商标归其各自权利人所有，此处仅为指明上游来源。
- 使用者应遵守上游仓库的许可条款以及本仓库 `LICENSE` 的约定；再分发时请保留本 NOTICE 与上游 LICENSE。

## 5. 修改者

- **署名**：Astra-Ursae-Majoris
- **发布仓库**：https://github.com/Astra-Ursae-Majoris/Deepseek-Harness-Local-UI
