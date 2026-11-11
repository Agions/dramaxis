# 本地开发与环境准备指南 (Local Development)

本文档面向全栈与底层核心贡献者，介绍如何在本地工作站快速搭建 **Dramaxis (剧枢)** 的完整开发与调试环境。

---

## 1. 工具链依赖矩阵

在克隆仓库前，请确保本地满足以下工具链版本要求：

| 工具链组件 | 推荐版本 | 安装与版本验证指令 | 说明 |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.18.0` (LTS) | `node -v` | 推荐使用 nvm 或 fnm 统一管理 |
| **pnpm** | `>= 9.0.0` | `pnpm -v` | 通过 `corepack enable pnpm` 开启 |
| **Rust 编译器** | `>= 1.82.0 (Stable)` | `rustc -V && cargo -V` | 通过 `rustup update stable` 安装 |
| **Tauri CLI** | `v2.x` | `pnpm tauri -V` | 项目内已通过 devDependencies 集成 |
| **FFmpeg** | `>= 6.0` | `ffmpeg -version` | 必须位于系统 `PATH` 环境变量中 |

> [!NOTE]
> **Windows 环境前置**：需通过 Visual Studio Installer 安装「使用 C++ 的桌面开发」工作负荷（MSVC v143+ 及 Windows 10/11 SDK），并确保系统已具备 Microsoft Edge WebView2 运行时。

---

## 2. 初始引导与环境联调

```bash
# 1. 克隆代码仓库
git clone https://github.com/Agions/dramaxis.git
cd dramaxis

# 2. 安装前端 Monorepo 全量依赖
pnpm install

# 3. 编译并校验 Rust 后端代码与强类型契约
pnpm gen:ipc

# 4. 运行全栈质量测试套件
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml --all

# 5. 启动桌面端热重载实时开发服务器
pnpm tauri dev
```

---

## 3. 核心开发脚本清单

项目根目录 `package.json` 内建了一套高效的工程化脚本命令：

```bash
# 自动提取 Rust 结构体与 Commands 并重写前端 @dramaxis/ipc 类型
pnpm gen:ipc

# 执行全套文档死链与排版规范扫描
pnpm docs:check

# 运行 VitePress 本地实时文档预览服务器 (http://localhost:5173)
pnpm docs:dev

# 构建生产环境文档静态站点
pnpm docs:build

# 执行前端全量 Vitest 单元测试
pnpm test

# 执行前端 TypeScript 严格无报错类型检查
pnpm tsc --noEmit

# 执行 Rust 代码规范检查 (零警告红线)
cargo clippy --manifest-path src-tauri/Cargo.toml --all
```
