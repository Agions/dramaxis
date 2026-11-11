---
layout: home

hero:
  name: "Dramaxis 文档中心"
  text: "电影级 Multi-Agent 短剧 AI 叙事与智能解说平台"
  tagline: 基于 Tauri 2.0 + Rust 原生微模块 (11 Crates) + React 19 / TypeScript 的自动化短剧与解说生产桌面工作台
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
    title: 6-Agent 状态图协同编导中枢
    details: 总控导演、视觉分析师、金牌编剧、声乐调音师、混音剪辑师、质量守门员 6 大智能体基于 StateGraph + Blackboard 协同推演剧情冲突与留存张力曲线。
  - icon: 🦀
    title: 11 大 Rust 原生领域引擎
    details: 场景硬切检测、Scene-RAG 多模态感知、VAD 毫秒级静音断句、DualDrivenAligner 声画对齐与 BGM 侧链智能避让，单机硬件加速渲染。
  - icon: ✂️
    title: 剪映 PC 端原生草稿直出
    details: 告别漫长视频重编码，直接生成剪映标准工程草稿 (.draft)，在剪映中打开即可实现 100% 无损二次精修。
  - icon: 🛡️
    title: 8 大主流平台标准母带交付
    details: 内置抖音、快手、小红书、视频号、B站、TikTok、YouTube/Shorts 等标准画幅 (9:16/16:9/3:4) 预设与发布前合规体检。
  - icon: 🤖
    title: 11 大主流大模型矩阵适配
    details: 原生集成通义千问 Qwen、DeepSeek V3/R1、OpenAI GPT-4o、Claude Sonnet、Gemini 2.5、智谱 GLM 等主流推理与多模态模型。
  - icon: 🎙️
    title: 48kHz 影视级配音与音色克隆
    details: 整合 Edge-TTS、OpenAI-TTS、MiniMax 与 GPT-SoVITS 本地零样本音色克隆，支持 SSML 语速控制与真实音频时长探针校准。
---

## 快速导航 (Quick Navigation)

| 核心板块                                                   | 说明                                                                      | 推荐受众                    |
| :--------------------------------------------------------- | :------------------------------------------------------------------------ | :-------------------------- |
| [**📖 指南与实战 (Guide)**](/guide/getting-started)        | 从 0 到 1 导入素材、选择工作流模板、编排 6-Agent 与导出剪映草稿           | 创作者、内容策划、运营同学  |
| [**🏛️ 架构设计 (Architecture)**](/architecture/overview)   | 洋葱拓扑模型、StateGraph 状态图与版本化黑板中枢、Monorepo 隔离与安全设计  | 架构师、全栈开发者          |
| [**🦀 Rust Crates 深度参考**](/crates/dramaxis-core)         | 11 个 Rust 独立领域的结构体建模、算法实现逻辑与核心 Trait 手册            | Rust 核心开发者、底层工程师 |
| [**📦 前端 Packages 手册**](/packages/ipc)                 | `@dramaxis/ipc`、`@dramaxis/core`、`@dramaxis/ui`、`@dramaxis/utils` 指南 | 前端开发者、UI/UX 工程师    |
| [**🔌 Tauri IPC 契约字典**](/api/commands-dictionary)      | 全量 Tauri Command 与 Event 字典，强类型参数与返回值标准                  | 全栈开发者、集成开发者      |
| [**🛠️ DevOps 与交付 (DevOps)**](/devops/local-development) | 本地调试、自动化代码生成 (`pnpm gen:ipc`)、多平台打包构建                 | 运维工程师、测试工程师      |
