# 本地开发与环境准备 (Local Development)

本文档介绍如何在本地机器上快速搭建 splicr 全栈开发环境。

---

## 1. 基础依赖清单

确保已安装以下开发工具链：

- **Node.js**：v20.x 或 v22.x (LTS)
- **pnpm**：v9.x 及以上 (`corepack enable pnpm`)
- **Rust**：1.82.0 及以上稳定版 (`rustup update stable`)
- **Tauri 2 CLI**：`cargo install tauri-cli --version "^2.0"`
- **FFmpeg**：系统已安装并在 PATH 中可用

---

## 2. 启动本地全栈联调

```bash
# 1. 克隆代码仓库
git clone https://github.com/qingshanyanyu/splicr.git
cd splicr

# 2. 安装前端与 packages 依赖
pnpm install

# 3. 生成 IPC 强类型契约
pnpm gen:ipc

# 4. 运行全栈测试确保健康
pnpm test
cargo test --all

# 5. 启动 Tauri 2 桌面端热重载开发服务器
pnpm tauri dev
```
