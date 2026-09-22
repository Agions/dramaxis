# splicr-core · 统一核心模型与基础服务

`splicr-core` 是整个系统的基石模块，承载核心领域实体 (`domain.rs`)、轻量依赖注入容器 (`container.rs`)、统一上下文 (`context.rs`)、统一错误体系 (`error.rs`) 与日志基础设施。

---

## 1. 核心领域实体 (`domain.rs`)

所有核心实体均实现 `Serialize`, `Deserialize`, `Clone`，并通过 `kebab-case` 或 `camelCase` 与前端保持单源类型对齐：

```rust
// 核心工程记录
pub struct Project {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings: ProjectSettings,
    pub timeline: Timeline,
}

// 多媒体工程时间轴
pub struct Timeline {
    pub duration_seconds: f64,
    pub tracks: Vec<Track>,
}

// 轨道类型定义 (5 轨模型)
pub enum TrackKind {
    Video,
    Audio,
    Subtitle,
}

// 四大生产策略
pub enum ExportStrategy {
    Single,
    Concat,
    Batch,
    Series,
}
```

---

## 2. 依赖注入容器 (`AppContext`)

通过 `ServiceContainer` 实现服务的线程安全注册与运行时懒加载解析：

```rust
// 在 Tauri 初始化时构建上下文
let ctx = AppContext::builder()
    .register(UpdateService::new(version, repo))
    .register(StorageService::new(data_dir))
    .build();

// 在 Tauri Command 中解析
let svc = state.service::<splicr_update::UpdateService>().await?;
```

---

## 3. 统一错误体系 (`SplicrError`)

全系统强类型错误枚举，精准映射错误来源并输出本地化友好的错误提示。
