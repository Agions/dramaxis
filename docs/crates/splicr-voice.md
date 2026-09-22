# splicr-voice · 48kHz 广播级配音与音色克隆引擎

`splicr-voice` 负责影视解说人声合成、情绪声线注入、GPT-SoVITS 零样本音色克隆与多格式音频切片生成。

---

## 1. 核心特性

- **多供应商统一工厂**：封装 Edge TTS、OpenAI TTS、GPT-SoVITS 及小米 MiMo TTS。
- **SSML 动态标记注入**：根据编剧智能体输出的情绪标签，自动注入语速 (`rate`)、音高 (`pitch`) 与音量 (`volume`) 微调指令。
- **48kHz 广播级采样率**：合成音频统一重采样为 48kHz 24-bit 广播级标准，保障影视剪辑听感饱满。

---

## 2. 核心接口与数据结构

```rust
pub struct VoicePreviewParams {
    pub provider: TtsProviderKind,
    pub voice_id: String,
    pub text: String,
    pub speed: f32,
    pub pitch: f32,
}

pub struct VoicePreviewResult {
    pub audio_path: String,
    pub duration_seconds: f64,
}
```
