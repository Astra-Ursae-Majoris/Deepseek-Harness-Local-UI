# DeepSeek Harness 本地桌面版（Deepseek-Harness-Local-UI）

> **免命令行 · 一键管理 DeepSeek Harness 本地服务 · 支持 Python 自编译**

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT 协议）的本地增强发行版：内置服务管家（启动 / 停止 / 重启 / 状态）、一键打开 GUI，并附带修改版 Web GUI 增强（对话大纲导航、回退到这一步、重新生成）。

本项目是 DeepSeek Harness 的**二次开发**（基于官方提交 `f98a57e` 修改），全部代码依据 MIT 开源协议发布。上游版权归 DeepSeek 所有；代码构成、占比与改动声明详见 [NOTICE.md](NOTICE.md)。

---

## 📖 目录

- [为什么做这个](#-为什么做这个)
- [功能特性](#-功能特性)
- [系统要求](#-系统要求)
- [快速开始](#-快速开始)
- [Python 启动器使用指南](#-python-启动器使用指南)
- [自编译 EXE（可选）](#-自编译-exe可选)
- [Electron 桌面壳（可选）](#-electron-桌面壳可选)
- [修改版 Web GUI 增强](#-修改版-web-gui-增强)
- [从源码构建（开发者）](#-从源码构建开发者)
- [项目结构](#-项目结构)
- [代码构成与占比](#-代码构成与占比)
- [常见问题 FAQ](#-常见问题-faq)
- [安全设计](#-安全设计)
- [开源许可与法律声明](#-开源许可与法律声明)
- [致谢](#-致谢)

---

## 🤔 为什么做这个

DeepSeek Harness 的 Web GUI 在浏览器中使用，对日常使用有几个不便：

- 浏览器没有**右键拖拽前进/后退**手势，侧边栏开关不够顺手；
- 浏览器自带快捷键（Ctrl+T / Ctrl+W / Ctrl+L 等）会**抢走**输入焦点；
- 启动 / 停止 / 重启后端服务需要在命令行里敲命令；
- 长对话缺少**全局大纲导航**，翻历史只能慢慢滚动。

这个发行版把这些痛点一次性解决：

1. **服务管家**：点按钮启动 / 停止 / 重启 DSH 服务，实时显示状态，全程不用命令行；
2. **对话大纲**：右侧常驻目录，点击任意轮次直接定位，长对话不再迷路；
3. **多种打开方式**：Python 启动器（推荐）→ 自动打开系统浏览器；WebView 窗口版 → 原生窗口体验；Electron 桌面壳（可选）→ 手势 / 托盘 / 快捷键屏蔽。

## ✨ 功能特性

### Python 启动器（推荐，本仓库原创）

- **纯 Python 实现**：仅用标准库 + tkinter，**零第三方依赖**，安装 Python 即可运行；
- **一键服务管理**：启动 / 停止 / 重启 DSH 服务，实时状态显示（运行中 / 已停止）；
- **一键打开界面**：自动打开系统默认浏览器访问 Web GUI；
- **自动检测 DSH 目录**：`DSH_HOME` 环境变量 → 同级 `harness/` → 常见位置 → 手动选择（纯 UI）；
- **自编译 EXE**：自带 `build_exe.bat`，用户可在**自己电脑**上用 PyInstaller 编译为 EXE——自编译产物没有“来自网络”标记，**不会触发 SmartScreen 拦截**；
- 设置记忆（记住目录与端口），界面中文，简单直观。

### WebView 窗口版（可选）

- 基于 [pywebview](https://pywebview.flowrl.com/)（系统 WebView2），把 Web GUI 装进原生窗口；
- 同样支持自编译 EXE；
- 需要 `pip install pywebview`。

### Electron 桌面壳（可选，源码保留）

- 原生窗口 + 右键手势 + 快捷键屏蔽 + 文件拖放 + 托盘常驻；
- 源码在 `src/`，需要 Node.js 环境自行构建；
- 注意：对外分发 EXE 需要代码签名证书，否则 SmartScreen 会提示（见 FAQ）。

### 修改版 Web GUI 增强

- **对话大纲导航栏**：右侧常驻目录，完整加载全部对话轮次（每轮显示首句摘要），点击定位 + 高亮，支持收起；
- **回退到这一步**：用户消息悬浮按钮，在该轮之前创建分支（fork）并打开子会话；
- **重新生成**：用户消息悬浮按钮，在该轮之前创建分支并自动重发原消息；
- **大纲服务端接口**：新增 `session.outline` RPC，返回整份会话日志的逐轮摘要。

### 完整保留上游能力

全部 DeepSeek Harness 插件体系原样保留：工具（bash / 文件 / 网页搜索 / 工作流 / 子代理等）、会话持久化（JSONL / SQLite）、技能系统、计划模式、审批与交互、Python SDK 等。

## 💻 系统要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | Windows 10 / 11（x64） | Python 启动器也可在 macOS / Linux 运行（需有 tkinter） |
| Python | ≥ 3.10 | 运行 Python 启动器（3.14 已测试） |
| Node.js | ≥ 22.19（或 ≥ 24） | 运行 DSH 服务所需 |
| pnpm | ≥ 9 | 安装源码依赖 |
| DeepSeek API Key | 需要 | 在 `.env` 或环境变量中配置 |
| 磁盘空间 | ≥ 2 GB | 源码 + 依赖 + 会话数据 |

## 🚀 快速开始

```bash
# 1. 准备环境
#    Node.js ≥ 22.19 + pnpm ≥ 9 + Python ≥ 3.10

# 2. 安装 DSH 依赖（只需一次）
cd harness
pnpm install

# 3. 配置 API 密钥（二选一）
echo DEEPSEEK_API_KEY=你的密钥 > .env

# 4. 启动服务 + 打开界面（两种方式任选）
cd ..
python desktop-py/dsh_launcher.py   # 推荐：图形界面，点「启动服务」+「打开界面」
# 或不用启动器，直接命令行：
# cd harness && pnpm dsh web --host 127.0.0.1 --port 3080
# 然后浏览器访问 http://127.0.0.1:3080
```

## 🐍 Python 启动器使用指南

```bash
cd desktop-py
python dsh_launcher.py
```

| 按钮 | 说明 |
| --- | --- |
| 🚀 启动服务 | 启动本地 DSH 服务（自动定位 harness/ 目录） |
| ⏹ 停止服务 | 停止服务（整棵进程树终止） |
| 🔄 重启服务 | 先停止再启动 |
| 🌐 打开界面 | 在系统默认浏览器打开 Web GUI |
| 更改 DSH 目录… | 手动选择 DSH 源码目录（需包含 apps/cli） |

服务状态实时显示（● 运行中 / ○ 已停止），日志区记录每一步操作结果。

## 🔨 自编译 EXE（可选）

不想装 Python？可以在**自己电脑上**把启动器编译成独立 EXE：

```bash
cd desktop-py
build_exe.bat          # 按提示选择版本（1=纯 Python，2=WebView）
# 产物：desktop-py/dist/DSH-Desktop-Python.exe
```

**为什么自己编译不会被拦截？** SmartScreen 拦截的是“从网络下载 + 未签名”的组合。自己编译的 EXE 没有“来自网络”标记（Mark-of-the-Web），因此**不会**出现“无法验证发布者”的警告，双击即用。

## 🖥 Electron 桌面壳（可选）

仓库保留 Electron 桌面壳源码（`src/`、`scripts/`、`tests/`），如需使用：

```bash
npm install
npm run build
npm test
npx electron .                    # 本地运行
npx electron-builder --win --publish never   # 打包 EXE
```

> ⚠️ 若要把 Electron EXE 分发给他人，需要**代码签名证书**（商业 CA 如 DigiCert / Sectigo，个人可申请 OV 证书）才能消除 SmartScreen 提示。个人自用场景建议直接用 Python 启动器 + 自编译。

## 🔍 修改版 Web GUI 增强

### 对话大纲导航栏

- 位于聊天区**右侧**，与左侧工作区 / 中间聊天区构成三栏布局，各自独立滚动；
- **完整加载**全部对话轮次（不依赖窗口分页），每轮显示首句摘要；
- 点击任意轮次 → 自动滚动定位到对应消息，并**高亮闪烁**提示；
- 正在进行的轮次显示「生成中…」，仅有工具调用的轮次显示「工具调用」，无回复的轮次显示「无回复」；
- 窗口过窄（< 760px）时**自动收起**为窄条；也可以点「收起目录栏」手动收起。

### 回退到这一步 / 重新生成

- 鼠标悬浮到任意**用户消息**上，出现两个按钮：
  - 「回退到这一步」：在该轮之前创建分支（fork），打开子会话，保留此前的全部上下文；
  - 「重新生成」：创建分支后**自动重发**该条消息，直接得到新回复；
- 子会话标题自动递增（如「计划（2）」），方便区分。

## 🛠 从源码构建（开发者）

### DSH 源码（harness/）

完整保留官方开发流程：`pnpm install` → `pnpm run test` / `typecheck` / `build` 等，详见 `harness/README.md`。

### Python 启动器

```bash
cd desktop-py
python dsh_launcher.py      # 直接运行（无需安装任何第三方包）
python -m py_compile dsh_launcher.py   # 语法检查
build_exe.bat              # 编译为 EXE
```

## 📁 项目结构

```
Deepseek-Harness-Local-UI/
├── desktop-py/             # Python 启动器（推荐）
│   ├── dsh_launcher.py     # 纯 Python 图形启动器（tkinter，零依赖）
│   ├── dsh_webview.py      # WebView 窗口版（pywebview，可选）
│   ├── build_exe.bat       # 自编译 EXE 脚本（PyInstaller）
│   └── requirements.txt    # WebView 版可选依赖
├── src/                    # Electron 桌面壳源码（可选方案）
├── scripts/                # Electron 构建辅助脚本
├── tests/                  # Electron 单元测试
├── harness/                # DeepSeek Harness 官方源码（修改版，MIT）
│   ├── packages/           # 全部上游插件包
│   ├── apps/               # CLI / Web 应用
│   └── LICENSE             # 上游 MIT 许可证（原样保留）
├── LICENSE                 # 本仓库 MIT 许可证（DeepSeek + 修改者）
├── NOTICE.md               # 代码占比 / 改动声明 / 法律说明
└── README.md               # 本文件
```

## 📊 代码构成与占比

| 构成 | 规模 | 占比 |
| --- | --- | --- |
| DeepSeek Harness 官方源码（`harness/`，基线提交 f98a57e） | ≈ 742,000 行 | ≈ 99.75% |
| 本仓库对上游的修改（44 个文件，净增 ≈ 1,845 行） | ≈ 1,845 行 | ≈ 0.25% |
| Python 启动器 / WebView / Electron 壳（本仓库原创） | ≈ 3,000 行 | 独立新增 |

详细的改动清单与声明见 [NOTICE.md](NOTICE.md)。

## ❓ 常见问题 FAQ

**Q：双击 Electron EXE 时 Windows 提示「无法验证发布者 / 已保护你的电脑」？**
A：这是 SmartScreen 对“从网络下载的未签名 EXE”的标准拦截。建议改用 **Python 启动器 + 自编译**（`desktop-py/build_exe.bat`）——自己编译的 EXE 不会触发该提示。若必须分发 Electron EXE，请申请商业代码签名证书（个人可申请 OV 证书，如 DigiCert / Sectigo / Certum）。

**Q：Python 启动器需要装什么依赖？**
A：纯 Python 版**零依赖**（标准库 + tkinter，Python 自带）。只有 WebView 窗口版需要 `pip install pywebview`。

**Q：找不到 DSH 安装目录？**
A：点「更改 DSH 目录…」选择包含 `apps/cli/src/bin.ts` 的 `harness/` 目录；也可以设置环境变量 `DSH_HOME`。

**Q：启动服务失败 / 端口被占用？**
A：启动器会检测端口占用；点「重启服务」会终止占用端口的进程并重新启动。

**Q：服务停了之后，我的对话数据会丢吗？**
A：不会。对话数据持久化在 DSH 的会话存储中，服务重启后历史完整保留。

**Q：需要联网才能用吗？**
A：需要。聊天依赖 DeepSeek API（需要 API Key），但所有服务都在本机运行，您的对话内容不会上传到除 DeepSeek API 以外的任何地方。

**Q：启动器会存我的 API 密钥吗？**
A：不存。密钥只读取系统环境变量 / `.env`，启动器自身不存储、不上传。

**Q：这个项目和 DeepSeek 官方是什么关系？**
A：没有任何隶属 / 背书关系。这是基于官方开源代码（MIT）的个人二次开发发行版。

## 🔒 安全设计

- **服务仅绑定本机**：`--host 127.0.0.1`，不对外网开放；
- **不存储凭证**：API 密钥只读环境变量 / `.env`；
- **停止即杀进程树**：停止服务时整棵进程树终止，不留孤儿进程；
- **Electron 壳额外防护**：URL 白名单、渲染进程沙箱、权限拒绝（见 `src/` 源码）。

## 📜 开源许可与法律声明

- 本项目遵循 **MIT License**，完整文本见 [LICENSE](LICENSE)；
- **上游版权**：Copyright (c) 2026 DeepSeek —— 见 `harness/LICENSE`（原样保留，未修改）；
- **修改者**：Astra-Ursae-Majoris（版权声明见根 LICENSE）；
- **代码占比与改动声明**：见 [NOTICE.md](NOTICE.md)；
- 本项目与 DeepSeek 公司及其关联方**无任何隶属、背书或合作关系**；「DeepSeek」等商标归各自权利人所有，此处仅为指明上游来源；
- 按 MIT 协议，本软件按「AS IS」提供，不附带任何明示或默示担保；作者与版权持有人不对任何索赔、损害或其他责任负责；
- 再分发时请保留本仓库 LICENSE、NOTICE.md 与 `harness/LICENSE`。

## 🙏 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 上游项目（MIT License）；
- [Electron](https://www.electronjs.org/) —— 可选桌面壳的运行时；
- [pywebview](https://pywebview.flowrl.com/) —— 可选 WebView 窗口库；
- [Cordis](https://github.com/cordiverse/cordis) —— 上游所用的插件框架。
