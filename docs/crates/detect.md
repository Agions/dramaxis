# dramaxis-detect · FFmpeg 原生编解码探针与 Scene-RAG 视觉检索

`dramaxis-detect` 是 Dramaxis 的视觉感知中枢。它不仅深度封装了宿主 FFmpeg 的元数据探针与帧间场景突变检测，更内建了面向多模态大模型的 **`SceneRagEngine` (镜头图文语义检索架构)** 与 **硬件编解码加速探针**。

---

## 1. 原生 FFmpeg 抽象与硬件加速探测 (`lib.rs`)

`Ffmpeg` 结构体提供线程安全的媒体操作抽象，开箱即用支持各大主流硬件加速后端：

```rust
#[derive(Debug, Clone)]
pub struct Ffmpeg {
    pub ffmpeg_bin: PathBuf,
    pub ffprobe_bin: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HardwareAccelerationKind {
    /// Apple Silicon 统一内存硬件加速 (VideoToolbox)
    VideoToolbox,
    /// NVIDIA GPU 专用硬件加速 (NVENC/NVDEC)
    Nvenc,
    /// Intel 核心显卡加速 (QuickSync Video)
    Qsv,
    /// Linux 通用硬件加速接口 (VA-API / VDPAU)
    Vaapi,
}
```

### 媒体流全量探针 (`FfmpegProbe`)

通过一次高效的 `ffprobe -show_streams -show_format -print_format json` 扫描，提取出毫秒级精度元数据：
- 画面绝对分辨率与非均匀像素宽高比 (SAR/DAR)；
- 真实时间基（Timebase）与可变帧率 (VFR) 平滑检测；
- 音轨格式、声道布局（Mono / Stereo / 5.1）与音频采样率；
- 编码器签名与色彩元数据（HDR 曲线、BT.709 / BT.2020 广色域）。

---

## 2. 场景突变打点与关键帧抽样

为了给编剧智能体划分分镜骨架，引擎使用优化后的场景切换算法过滤器：

```bash
ffmpeg -i input.mp4 -filter_complex "select='gt(scene,0.38)',metadata=print:file=-" -f null -
```

1. **帧间直方图突变识别**：基于色彩与亮度分量跃变率定位物理镜头切点，过滤渐变转场与镜头抖动造成的误识别；
2. **多模态关键帧抽取**：在每个识别出的场景中轴点抽取高质量 JPEG 关键帧并转换为 Base64 编码，为编剧与视觉分析师提供多模态输入；
3. **弹性容错降级**：若素材无明显物理切点或处于极端低码率环境，引擎自动平滑降级为按黄金节奏（如每 4~6 秒）等距自适应采样，保障流水线绝对可用。

---

## 3. 镜头图文语义检索 (`SceneRagEngine`)

在 `multimodal.rs` 中，`SceneRagEngine` 实现了基于局部特征向量与文本描述的余弦相似度匹配（Cosine Similarity）：

```mermaid
graph LR
    Shots[候选场景关键帧列表] --> FeatureExt[视觉特征抽取 / 打标]
    FeatureExt --> RagIndex[SceneRagEngine 向量索引库]
    ScriptText[编剧台词: '主角在暴雨中绝望嘶吼'] --> TextVector[语义特征检索]
    TextVector --> RagIndex
    RagIndex --> BestShot[最高匹配度分镜镜头: Scene 04 / 相似度 0.94]
```

通过这一算法，编剧写出具有强烈冲突或悲伤氛围的独白时，混音剪辑师能够通过 RAG 引擎瞬间从海量镜头库中反查出情绪最贴合的画面切片，实现真正的“神形兼备”与视听高度共鸣。
