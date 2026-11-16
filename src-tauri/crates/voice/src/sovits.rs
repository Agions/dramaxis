//! GPT-SoVITS 本地推理 API TTS 引擎

use crate::{tts_err, write_output, TtsEngine, TtsOutcome, TtsProviderKind, TtsRequest};
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;

#[derive(Debug, Clone)]
pub struct GptSovitsOptions {
    pub base_url: String,
    pub ref_audio_path: String,
    pub prompt_text: String,
    pub prompt_lang: String,
}

impl Default for GptSovitsOptions {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:9880".into(),
            ref_audio_path: String::new(),
            prompt_text: String::new(),
            prompt_lang: "zh".into(),
        }
    }
}

#[derive(Debug)]
pub struct GptSovitsTtsEngine {
    opts: GptSovitsOptions,
    client: reqwest::Client,
}

impl GptSovitsTtsEngine {
    pub fn new(opts: GptSovitsOptions) -> Self {
        Self {
            opts,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl TtsEngine for GptSovitsTtsEngine {
    fn kind(&self) -> TtsProviderKind {
        TtsProviderKind::GptSovits
    }

    async fn synthesize(&self, req: &TtsRequest) -> DramaxisResult<TtsOutcome> {
        if self.opts.ref_audio_path.is_empty() {
            return Err(tts_err(
                TtsProviderKind::GptSovits,
                "ref_audio_path 未配置 (GPT-SoVITS 需要参考音频克隆音色)",
            ));
        }
        let url = format!("{}/tts", self.opts.base_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "text": req.text,
            "text_lang": "zh",
            "ref_audio_path": self.opts.ref_audio_path,
            "prompt_text": self.opts.prompt_text,
            "prompt_lang": self.opts.prompt_lang,
            "speed_factor": (100 + req.rate_percent).clamp(50, 150) as f64 / 100.0,
        });
        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tts_err(
                    TtsProviderKind::GptSovits,
                    format!("无法连接 GPT-SoVITS API ({}): {e}", self.opts.base_url),
                )
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(tts_err(
                TtsProviderKind::GptSovits,
                format!("HTTP {status}: {}", crate::truncate(&text, 300)),
            ));
        }
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| tts_err(TtsProviderKind::GptSovits, format!("read body: {e}")))?;
        let n = write_output(&req.output_path, &bytes).await?;
        Ok(TtsOutcome {
            bytes_written: n,
            format: "wav",
        })
    }
}
