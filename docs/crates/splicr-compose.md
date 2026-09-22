# splicr-compose · 5 轨毫秒级磁吸与 BGM 智能避让

`splicr-compose` 是时间轴多媒体合成与音频调音的中枢引擎，负责 5 轨对齐、BGM 自动避让 (`-6dB`) 与多步骤流水线状态编排。

---

## 1. 核心特性

- **5 轨多媒体拓扑**：
  1. 主视频轨 (`Main Video Track`)
  2. 解说人声轨 (`Voice Narration Track`)
  3. BGM 音乐轨 (`Background Music Track`)
  4. 音效氛围轨 (`Sound Effect Track`)
  5. 动态字幕轨 (`Subtitle Track`)
- **BGM 智能避让 (Audio Ducking)**：
  - 自动检测人声音轨的时间区间。
  - 在有人声说话的前 200ms 自动平滑淡出 BGM（降低 -6dB 至 -10dB），说话结束后 300ms 自动回弹至默认音量。

---

## 2. 流水线步骤定义 (`StepDef`)

```rust
pub struct StepDef {
    pub id: String,
    pub name: String,
    pub status: StepStatus,
    pub progress_percent: u8,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
}

pub enum StepStatus {
    Pending,
    Running,
    Success,
    Failed,
    Skipped,
}
```
