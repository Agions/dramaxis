# Resources · 资源管理

本目录存放 Dramaxis 桌面端打包随附的离线文档与离线资源。

## 目录结构

```text
resources/
├── docs/
│   └── quick.md    # 离线极速创作指南（由 tauri.conf.json 打包进应用资源包）
└── README.md       # 本说明文件
```

## 规范说明

1. **打包资源最小化**：`src-tauri/tauri.conf.json` 中配置随包发布的资源仅包含 `../resources/docs/*`。为避免安装包体积膨胀，禁止在此目录入库大体积音视频测试文件或编译生成的临时文档。
2. **应用图标统一管理**：桌面端跨平台系统图标统一定位在 `src-tauri/icons/`（含 `.icns`, `.ico`, 各尺寸 `.png`），网页端与移动端图标统一定位在 `public/` 与 `docs/public/`。
3. **品牌设计系统**：统一采用黑金电影调光室标准品牌识别（金黄色渐变 `D` 字母与中央 `Play` 棱镜），色彩使用 CSS 变量与 Tailwind v4 设计令牌统一驱动。
