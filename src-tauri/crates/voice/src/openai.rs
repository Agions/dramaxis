//! OpenAI 兼容 TTS 引擎 (/v1/audio/speech)

use crate::{tts_err, write_output, TtsEngine, TtsOutcome, TtsProviderKind, TtsRequest};
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;

#[derive(Debug, Clone)]
pub struct OpenAiTtsOptions {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub voice: String,
}

impl Default for OpenAiTtsOptions {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.openai.com".into(),
            model: "tts-1".into(),
            voice: "alloy".into(),
        }
    }
}

#[derive(Debug)]
pub struct OpenAiTtsEngine {
    opts: OpenAiTtsOptions,
    client: reqwest::Client,
}

impl OpenAiTtsEngine {
    pub fn new(opts: OpenAiTtsOptions) -> Self {
        Self {
            opts,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl TtsEngine for OpenAiTtsEngine {
    fn kind(&self) -> TtsProviderKind {
        TtsProviderKind::OpenAi
    }

    async fn synthesize(&self, req: &TtsRequest) -> DramaxisResult<TtsOutcome> {
        let base = self.opts.base_url.trim().trim_end_matches('/');
        let url = if base.ends_with("/audio/speech") {
            base.to_string()
        } else if base.ends_with("/v1") {
            format!("{base}/audio/speech")
        } else {
            format!("{base}/v1/audio/speech")
        };
        let speed = (100 + req.rate_percent).clamp(50, 150) as f64 / 100.0;
        let body = serde_json::json!({
            "model": self.opts.model,
            "input": req.text,
            "voice": req.voice.clone().unwrap_or_else(|| self.opts.voice.clone()),
            "response_format": "mp3",
            "speed": speed,
        });
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&self.opts.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| tts_err(TtsProviderKind::OpenAi, format!("request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(tts_err(
                TtsProviderKind::OpenAi,
                format!("HTTP {status}: {}", crate::truncate(&text, 300)),
            ));
        }
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| tts_err(TtsProviderKind::OpenAi, format!("read body: {e}")))?;
        let n = write_output(&req.output_path, &bytes).await?;
        Ok(TtsOutcome {
            bytes_written: n,
            format: "mp3",
        })
    }
}
