# splicr-detect · FFmpeg 场景突变打点与抽样引擎

`splicr-detect` 负责调用底层 FFmpeg 进行高精度的视频场景突变检测 (`select='gt(scene,0.4)'`)、关键帧抓取与音视频元数据 Probe 解析。

---

## 1. 核心算法与机制

- **场景突变打点**：利用帧间亮度与色彩直方图差异算法，精准提取镜头切换的时间戳序列。
- **关键帧抽样生成**：在场景突变点自动截取高清 JPEG 缩略图，作为编剧智能体观察画面冲突的视觉输入依据。
- **无 FFmpeg 降级模式**：若系统未安装 FFmpeg，自动降级为基于时长等距切分的容错模式，保障流水线不中断。

---

## 2. 探针结构体

```rust
pub struct FfmpegProbe {
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub video_codec: String,
    pub audio_codec: Option<String>,
    pub scene_changes: Vec<f64>,
}
```
