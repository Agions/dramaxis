# dramaxis-subtitle · VAD 语音端点检测与动态花字字幕引擎

`dramaxis-subtitle` 负责原片对白与配音轨的语音活动检测 (Voice Activity Detection, VAD)、停顿气口探测、毫秒级词槽对齐以及电影级动态花字（ASS / SRT / WebVTT / 剪映文本图元）的生成与排版。

---

## 1. 真实 VAD 语音端点检测 (`vad.rs`)

`dramaxis-subtitle` 结合宿主 FFmpeg 的 `silencedetect` 过滤器与自适应能量平滑算法，实现无需载入巨型重量级离线模型的毫秒级语音端点扫描：

```rust
/// VAD 探测配置参数
#[derive(Debug, Clone)]
pub struct VadConfig {
    /// 最小有效语音段时长（毫秒），小于此值的微小气口不切分
    pub min_segment_ms: u64,
    /// 静音电平阈值（dB），默认 -40.0dB，低于此阈值判定为背景静音
    pub silence_threshold_db: f32,
    /// 语音段合并间隔（毫秒），小于此间隔的紧密连读自动合并
    pub merge_gap_ms: u64,
}

/// 扫描音频文件并输出语音时间区间
pub async fn detect_segments(
    audio_path: &std::path::Path,
    config: &VadConfig,
) -> Result<Vec<SpeechSegment>, SubtitleError>;
```

### 探测执行逻辑

1. 执行低开销管道分析：`ffmpeg -i <audio> -af silencedetect=noise=-40dB:d=0.2 -f null -`；
2. 从 stderr 提取 `silence_start` 与 `silence_end` 时间戳；
3. 将非静音片段合并为连续的 `SpeechSegment { start_ms, end_ms }`；
4. 为剪辑师提供精准的原片留白区间，指导 BGM 避让与独白切入时机。

---

## 2. 影视级多格式字幕与样式引擎 (`lib.rs`)

引擎支持将结构化分镜文案自动排版为多种标准字幕格式，满足从专业影视后期到社交媒体短视频的全场景需求：

| 格式标准 | 核心特性 | 典型应用场景 |
| :--- | :--- | :--- |
| **标准 ASS (Advanced SubStation)** | 24-bit 矢量边框、发光阴影、屏幕绝对坐标锚定、Karaoke 逐字变色 (`\k`) | 电影感解说、高燃短剧、卡拉OK逐词高亮 |
| **通用 SRT (SubRip)** | 极简时间戳 + 文本，全球兼容性最佳 | 剪映二次导入、B站/YouTube 平台外挂软字幕 |
| **现代 WebVTT** | HTML5 原生支持、支持 CSS 样式类扩展 | Web 监看播放器预览、云端协同回放 |
| **剪映图元契约** | 直接生成包含字体名、字号、描边色值与透明度的 JSON 结构 | 导出剪映原生工程，打开即呈现完美排版 |

---

## 3. 情绪高亮与花字风格预设

为了最大化短视频平台的用户停留时长，引擎支持对字幕进行情绪打标与视觉分层渲染：

- **情绪关键词自动染色 (`process_entries_emotion_tagging`)**：
  自动识别文案中的转折词、悬念词与高潮词，在 ASS 渲染中局部插入 `{\c&H00F5C842&}`（琥珀金）或高对比警示色彩；
- **爆款花字预设集**：
  - **琥珀金 (Cinema Amber)**：影视院线大片解说专用，沉稳高级；
  - **黄黑重边 (Bold Warning)**：抖音快手爆款标配，极强阅读穿透力；
  - **悬疑深红 (Suspense Crimson)**：罪案与悬疑解说高能反转段落专用；
  - **极简冷白 (Minimalist White)**：纪录片与访谈型安静叙事风格。
