# splicr-intake · 4 大生成策略分流与素材摄取

`splicr-intake` 负责处理创作者导入的多媒体素材，根据用户选定的生产模式，规划分段与输出计划 (`OutputPlan`)。

---

## 1. 四大策略分流机制

1. **Single (单片精剪)**：
   - 约束：严格接收单个输入媒体，输出 1 个完整项目工程。
2. **Concat (多片段拼接)**：
   - 约束：至少接收 2 个媒体切片，按顺序逻辑合并生成统一解说流水线。
3. **Batch (批量并发)**：
   - 约束：接收 N 个独立视频，生成 N 个独立的 OutputPlan，彼此隔离并发推演。
4. **Series (连续剧集)**：
   - 约束：携带全局剧集上下文 (`SeriesContext`)，按第 1 集、第 2 集顺序保持人物设定记忆与伏笔传递。

---

## 2. 核心结构体

```rust
pub struct PlanOptions {
    pub strategy: ExportStrategy,
    pub source_paths: Vec<String>,
    pub series_context: Option<String>,
    pub episode_start: Option<u32>,
}

pub struct OutputPlan {
    pub id: String,
    pub title: String,
    pub source_files: Vec<String>,
    pub suggested_output_name: String,
    pub episode_index: Option<u32>,
}
```
