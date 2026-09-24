# 跨平台打包构建与发布 (Build & Release)

本文档说明如何构建发布生产级别的桌面客户端安装包与文档站点。

---

## 1. 文档站点构建与预览

```bash
# 本地启动 VitePress 文档热重载开发服务器
pnpm docs:dev

# 生产环境静态打包 (输出至 docs/.vitepress/dist)
pnpm docs:build

# 本地预览打包产物
pnpm docs:preview
```

---

## 2. 桌面客户端跨平台打包

```bash
# 1. 运行类型检查与全栈测试
pnpm typecheck
pnpm test
cargo test --all

# 2. 生成发布级桌面端安装包
# macOS: 输出 .dmg 与 .app 格式
# Windows: 输出 .msi 与 .exe (NSIS) 安装包
pnpm tauri build
```

---

## 3. GitHub Releases 自动发布流程

项目配置了 GitHub Actions 自动化工作流：

1. 打上语义化版本 Tag 并推送：
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. CI 自动矩阵构建 macOS (Intel/ARM64) 与 Windows (x64) 二进制。
3. 自动生成 SHA-256 Checksum 并上传至 GitHub Releases，客户端内置的 `splicr-update` 引擎将即刻检测到新版本并向用户推送呼吸角标通知。
