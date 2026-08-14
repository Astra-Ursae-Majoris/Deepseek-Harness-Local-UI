# DeepSeek Harness 本地桌面版（Deepseek-Harness-Local-UI）

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT 协议）的本地增强发行版：
**桌面 EXE 壳（免浏览器、免命令行）+ 修改版 Web GUI（对话大纲导航、回退/重新生成等增强）**。

> 本项目是 DeepSeek Harness 的二次开发（fork 级修改），全部代码依据 MIT 开源协议发布。
> 上游版权归 DeepSeek 所有，具体占比与改动声明见 [NOTICE.md](NOTICE.md)。

---

## ✨ 特性

- **桌面 EXE 应用**（Windows）：连接本地 DSH 服务、内置服务管家（启动/停止/状态一键操作）、右键手势、文件拖放、快捷键屏蔽，全程无需命令行
- **修改版 Web GUI 增强**：
  - 对话大纲导航栏（右侧常驻目录，点击定位任意对话轮次，支持收起）
  - 用户消息悬浮「回退到这一步」「重新生成」按钮
  - 大纲随会话滚动自动高亮、窗口过窄自动收起
- **完整保留上游能力**：全部 DeepSeek Harness 插件体系（工具、子代理、工作流、会话持久化等）

## 🚀 快速开始（最终用户）

### 方式一：直接使用 EXE（推荐，无需任何环境）

1. 从 [Releases](../../releases) 下载 `DSH-Desktop-<版本>-portable.exe`（便携版，双击即用）
2. 将 EXE 与源码解压到同一目录（保持 `harness/` 与 EXE 同级），或启动后点「更改 DSH 安装位置」选择 `harness/` 目录
3. 双击 EXE → 欢迎页点「🚀 启动服务」→ 自动进入聊天界面

> 首次使用请先按下方「准备 DSH 环境」安装依赖（只需要一次）。

### 方式二：从源码运行

```bash
# 1. 准备 DSH 环境（Node.js ≥ 22）
cd harness
npm install -g pnpm   # 若未安装
pnpm install

# 2. 启动 Web 服务
pnpm dsh web --host 127.0.0.1 --port 3080

# 3. 启动桌面壳（另开终端）
cd ..
npm install
npm run start
```

### 准备 DSH 环境（首次使用必做）

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.19（或 ≥ 24） | 运行 DSH 服务 |
| pnpm | ≥ 9 | 安装源码依赖 |
| DeepSeek API Key | - | 在 `.env` 或 GUI「模型/API 密钥管理」中配置 |

## 📁 目录结构

```
Deepseek-Harness-Local-UI/
├── src/            # 桌面 EXE 壳源码（Electron，原创）
├── scripts/        # 构建辅助脚本
├── tests/          # 桌面壳单元测试
├── harness/        # DeepSeek Harness 官方源码（修改版，MIT）
│   ├── packages/   # 全部上游插件包
│   └── ...
├── LICENSE         # MIT 许可证（含上游与修改者版权声明）
├── NOTICE.md       # 代码占比、改动声明与法律说明
└── package.json    # 桌面壳项目配置
```

## 🛠 开发者构建

```bash
npm install                       # 安装依赖
npm run build                     # TypeScript 编译 + 复制静态资源
npm test                          # 单元测试
npx electron-builder --win --publish never   # 打包 portable + nsis
```

打包产物位于 `release/`：`DSH-Desktop-<版本>-portable.exe`（便携）与 `DSH-Desktop-<版本>-setup.exe`（安装版）。

## 📜 开源许可与法律声明

- 本项目遵循 **MIT License**，完整文本见 [LICENSE](LICENSE)
- **上游版权**：Copyright (c) 2026 DeepSeek —— 见 `harness/LICENSE`（原样保留）
- **代码占比与修改声明**：见 [NOTICE.md](NOTICE.md)
- 本项目与上游、与 DeepSeek 公司无隶属关系；商标与名称归各自权利人所有
- 按 MIT 协议提供「AS IS」，不提供任何明示或默示担保

## 🙏 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 上游项目（MIT）
- [Electron](https://www.electronjs.org/) —— 桌面运行时
