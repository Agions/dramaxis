---
layout: home

hero:
  name: "Dramaxis 文档中心"
  text: "电影级 Multi-Agent 短剧 AI 叙事与智能解说平台"
  tagline: 基于 Tauri 2.0 + Rust 原生微模块 (12 Crates) + React 19 / TypeScript 的自动化短剧与解说生产桌面工厂
  image:
    src: /logo.svg
    alt: Dramaxis Logo
  actions:
    - theme: brand
      text: 🚀 快速上手
      link: /guide/getting-started
    - theme: alt
      text: 🏛️ 系统架构设计
      link: /architecture/overview
    - theme: alt
      text: 🔌 IPC 契约手册
      link: /api/commands-dictionary

features:
  - icon: 🎬
    title: 6-Agent 协同导演工作室
    details: 导演、编剧、配音、剪辑、调色、运营 6 大多智能体协同管线，全自动推演剧情冲突与情绪曲线。
  - icon: 🦀
    title: 12 大 Rust 原生领域引擎
    details: 场景突变检测、VAD 毫秒级静音断句、5 轨磁性吸附对齐与 BGM 智能避让 (-6dB)，单机极速硬件加速渲染。
  - icon: ✂️
    title: 剪映 PC 端原生草稿直出
    details: 告别漫长视频重编码，直接生成剪映标准工程草稿 (.draft)，在剪映中打开即可实现 100% 无损二次精修。
  - icon: 🛡️
    title: 8 大主流平台消重矩阵
    details: 融合 Fablr 核心技术，内置抖音、快手、小红书、TikTok、YouTube 等消重预设与随机化滤镜算法。
  - icon: 🤖
    title: 11 大最新大模型矩阵适配
    details: 原生集成 Claude 3.7、GPT-4o、DeepSeek V3/R1、Qwen 2.5、Gemini 2.0 等最新行业顶级模型。
  - icon: 🎙️
    title: 48kHz 影视级配音与音色克隆
    details: 整合 GPT-SoVITS 零样本音色克隆与 Edge/OpenAI TTS，支持角色情绪自动染色与音高语速微调。
---

## 快速导航 (Quick Navigation)

| 核心板块                                                   | 说明                                                                  | 推荐受众                    |
| :--------------------------------------------------------- | :-------------------------------------------------------------------- | :-------------------------- |
| [**📖 指南与实战 (Guide)**](/guide/getting-started)        | 从 0 到 1 导入素材、选择解说策略、编排 6-Agent 与导出剪映草稿         | 创作者、内容策划、运营同学  |
| [**🏛️ 架构设计 (Architecture)**](/architecture/overview)   | 洋葱拓扑模型、状态机协同中枢、Monorepo 前后端双向隔离与安全设计       | 架构师、全栈开发者          |
| [**🦀 Rust Crates 深度参考**](/crates/splicr-core)         | 12 个 Rust 独立领域的结构体建模、算法实现逻辑与核心 Trait 手册        | Rust 核心开发者、底层工程师 |
| [**📦 前端 Packages 手册**](/packages/ipc)                 | `@splicr/ipc`、`@splicr/core`、`@splicr/ui`、`@splicr/utils` 复用指南 | 前端开发者、UI/UX 工程师    |
| [**🔌 Tauri IPC 契约字典**](/api/commands-dictionary)      | 全量 44 个 Tauri Command 与 Event 字典，强类型参数与返回值标准        | 全栈开发者、插件开发者      |
| [**🛠️ DevOps 与交付 (DevOps)**](/devops/local-development) | 本地调试、自动化代码生成 (`pnpm gen:ipc`)、多平台打包构建             | 运维工程师、测试工程师      |
