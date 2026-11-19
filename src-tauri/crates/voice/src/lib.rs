//! dramaxis-voice v1.0.0 · TTS 配音与语音克隆引擎
//!
//! ## 责任范围 (严格遵循文件名 <= 8 字母规范)
//! - `openai`: OpenAI 兼容 `/v1/audio/speech` (openai.rs)
//! - `edge`: Microsoft Edge TTS (WebSocket 协议, 免费免密钥) (edge.rs)
//! - `sovits`: GPT-SoVITS 本地推理 API (sovits.rs)
//! - `mimo`: MiniMax / MiMo TTS 引擎 (mimo.rs)

pub mod edge;
pub mod mimo;
pub mod openai;
pub mod sovits;

pub use edge::{escape_xml, EdgeTtsEngine, EdgeTtsOptions};
pub use mimo::{MimoTtsEngine, MimoTtsOptions};
pub use openai::{OpenAiTtsEngine, OpenAiTtsOptions};
pub use sovits::{GptSovitsOptions, GptSovitsTtsEngine};

use async_trait::async_trait;
use dramaxis_core::error::{DramaxisError, DramaxisResult};
use std::path::{Path, PathBuf};

pub use dramaxis_core::error::TtsProviderKind;
pub use dramaxis_core::error::TtsProviderKind as ProviderKind;

/// 一次合成请求。
#[derive(Debug, Clone)]
pub struct TtsRequest {
    /// 待合成文本 (中文叙述段)
    pub text: String,
    /// 音色覆盖 (None = 引擎默认)
    pub voice: Option<String>,
    /// 语速百分比偏移 (-50..=+50, 0 = 常速)
    pub rate_percent: i32,
    /// 音频产物落盘路径 (mp3 / wav 由引擎决定)
    pub output_path: PathBuf,
}

/// 合成结果。
#[derive(Debug, Clone)]
pub struct TtsOutcome {
    pub bytes_written: u64,
    pub format: &'static str,
}

/// TTS 引擎统一抽象。
#[async_trait]
pub trait TtsEngine: Send + Sync {
    fn kind(&self) -> TtsProviderKind;
    async fn synthesize(&self, req: &TtsRequest) -> DramaxisResult<TtsOutcome>;
}

pub(crate) fn tts_err(provider: TtsProviderKind, message: impl Into<String>) -> DramaxisError {
    DramaxisError::Tts(format!("{provider:?}: {}", message.into()))
}

pub(crate) async fn write_output(path: &Path, bytes: &[u8]) -> DramaxisResult<u64> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, bytes).await?;
    Ok(bytes.len() as u64)
}

pub(crate) fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        s.chars().take(n).collect::<String>() + "…"
    }
}

/// 按引擎类型构造 (与 ConfigService 的 tts_provider 字段对接)。
#[derive(Debug)]
pub enum TtsEngineConfig {
    Edge(EdgeTtsOptions),
    OpenAi(OpenAiTtsOptions),
    GptSovits(GptSovitsOptions),
    Mimo(MimoTtsOptions),
}

pub fn engine(config: TtsEngineConfig) -> Box<dyn TtsEngine> {
    match config {
        TtsEngineConfig::Edge(o) => Box::new(EdgeTtsEngine::new(o)),
        TtsEngineConfig::OpenAi(o) => Box::new(OpenAiTtsEngine::new(o)),
        TtsEngineConfig::GptSovits(o) => Box::new(GptSovitsTtsEngine::new(o)),
        TtsEngineConfig::Mimo(o) => Box::new(MimoTtsEngine::new(o)),
    }
}

/// 便捷构造: 免费 Edge 引擎 (无密钥场景默认)
pub fn edge_engine() -> Box<dyn TtsEngine> {
    engine(TtsEngineConfig::Edge(EdgeTtsOptions::default()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn factory_kinds_correct() {
        let e = engine(TtsEngineConfig::Edge(EdgeTtsOptions::default()));
        assert_eq!(e.kind(), TtsProviderKind::Edge);
        let o = engine(TtsEngineConfig::OpenAi(OpenAiTtsOptions::default()));
        assert_eq!(o.kind(), TtsProviderKind::OpenAi);
        let g = engine(TtsEngineConfig::GptSovits(GptSovitsOptions::default()));
        assert_eq!(g.kind(), TtsProviderKind::GptSovits);
    }

    #[test]
    fn ssml_escapes_xml() {
        let e = EdgeTtsEngine::new(EdgeTtsOptions::default());
        let ssml = e.build_ssml(&TtsRequest {
            text: "我说：<你好> & '世界'".into(),
            voice: None,
            rate_percent: 10,
            output_path: PathBuf::from("/tmp/x.mp3"),
        });
        assert!(ssml.contains("&lt;你好&gt;"));
        assert!(ssml.contains("&amp;"));
        assert!(ssml.contains("rate='+10%'"));
        assert!(ssml.contains("zh-CN-XiaoxiaoNeural"));
    }

    #[test]
    fn gpt_sovits_requires_ref_audio() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let e = GptSovitsTtsEngine::new(GptSovitsOptions::default());
        let r = rt.block_on(e.synthesize(&TtsRequest {
            text: "测试".into(),
            voice: None,
            rate_percent: 0,
            output_path: PathBuf::from("/tmp/x.wav"),
        }));
        let err = r.unwrap_err();
        assert!(matches!(
            err,
            DramaxisError::Tts(msg) if msg.contains("GptSovits")
        ));
    }

    #[tokio::test]
    async fn write_output_creates_parent_dirs() {
        let dir = std::env::temp_dir().join(format!("sf-tts-test-{}", std::process::id()));
        let path = dir.join("nested/out.mp3");
        let n = write_output(&path, b"hello").await.unwrap();
        assert_eq!(n, 5);
        assert!(path.exists());
        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
