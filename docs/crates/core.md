# dramaxis-core · 统一核心领域模型与系统上下文

`dramaxis-core` 是整个 Dramaxis 桌面引擎的底层基石，承载全局统一的领域实体建模 (`domain.rs`)、服务依赖注入容器 (`container.rs`)、全局应用上下文 (`context.rs`)、强类型统一错误体系 (`error.rs`) 与结构化追踪日志基础设施。

---

## 1. 核心领域实体与多轨建模 (`domain.rs`)

所有核心实体均实现 `Serialize`, `Deserialize`, `Clone`，通过 `kebab-case` 与 `camelCase` 保持与前端 `@dramaxis/ipc` 单源强类型双向对齐：

```rust
use serde::{Deserialize, Serialize};

/// 影视解说全局工程记录实体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings: ProjectSettings,
    pub timeline: Timeline,
    pub media_files: Vec<MediaFile>,
    pub scripts: Vec<ScriptSegment>,
}

/// 毫秒级多轨音画复合时间轴
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub duration_seconds: f64,
    pub tracks: Vec<Track>,
}

/// 工业级 5 轨分类模型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrackKind {
    /// V1 视频画面主轨
    Video,
    /// A1 独白解说人声轨
    Voice,
    /// A2 环境音效轨
    Audio,
    /// A3 背景音乐配乐轨 (支持旁链自动避让)
    Bgm,
    /// T1 动态花字字幕轨
    Subtitle,
}

/// 4 大生产分流策略
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StrategyLabel {
    Single,
    Concat,
    Batch,
    Series,
}
```

---

## 2. 线程安全依赖注入容器 (`AppContext`)

为了防止各功能模块间形成强耦合网状调用，`dramaxis-core` 提供了轻量级依赖注入 (DI) 容器 `ServiceContainer` 与统一状态柄 `AppContext`。所有基础设施服务（如配置、存储、自更新）均以线程安全单例注册，支持异步延迟加载：

```rust
use dramaxis_core::container::ServiceContainer;
use dramaxis_core::services::{ConfigService, ProjectService, StorageService};
use std::sync::Arc;

// 在 Tauri Setup 阶段构建上下文单例
let ctx = AppContext::builder()
    .register(ConfigService::new(keychain_vault))
    .register(StorageService::new(sqlite_pool))
    .register(ProjectService::new(data_dir))
    .build();

// 在任一 Tauri Command 算子中通过类型安全反射解析
let config_svc = app_ctx.service::<ConfigService>().await?;
let snapshot = config_svc.snapshot().await;
```

---

## 3. 统一错误处理体系 (`error.rs`)

`dramaxis-core` 定义了系统唯一的顶层错误枚举 `DramaxisError`，涵盖全链路可能发生的算子失败与外部 I/O 异常，并精准携带故障来源与上下文，杜绝无意义的模糊抛错：

```rust
#[derive(thiserror::Error, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum DramaxisError {
    #[error("大语言模型调用异常 ({provider:?}): {message}")]
    Llm {
        provider: LlmProviderKind,
        message: String,
    },

    #[error("语音合成服务异常 ({provider}): {message}")]
    Tts {
        provider: String,
        message: String,
    },

    #[error("FFmpeg 外部媒体管道故障: {0}")]
    Ffmpeg(String),

    #[error("多智能体流水线中断或校验未通过: {0}")]
    Pipeline(String),

    #[error("本地持久化存储与资产校验异常: {0}")]
    Storage(String),

    #[error("非法输入或参数不合法: {0}")]
    InvalidInput(String),
}
```
