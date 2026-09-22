# splicr-subtitle · VAD 静音断句与动态字幕生成引擎

`splicr-subtitle` 负责音频语音活动检测 (VAD)、毫秒级静音断句、SRT/ASS 格式转换与样式化动态花字渲染。

---

## 1. 核心功能

- **VAD 智能切分**：基于能量与谱平坦度算法自动检测人声停顿气口（默认阈值 300ms），实现字音完全同步。
- **多格式导出支持**：
  - **SRT**：通用纯文本字幕，兼容所有播放器与剪辑软件。
  - **ASS**：支持描边、发光、定位与卡拉OK逐字变色动效的影视级字幕。
  - **VTT**：适配 Web 视频播放标准的 WebVTT 格式。

---

## 2. 核心结构体 (`src/vad.rs` & `src/lib.rs`)

```rust
pub struct VadConfig {
    pub sample_rate: u32,
    pub frame_size_ms: u32,
    pub threshold: f32,
    pub min_silence_duration_ms: u32,
}

pub struct SubtitleEntry {
    pub index: usize,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub text: String,
}
```
