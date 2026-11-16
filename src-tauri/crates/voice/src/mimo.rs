//! MiniMax / MiMo TTS 引擎

use crate::{tts_err, write_output, TtsEngine, TtsOutcome, TtsProviderKind, TtsRequest};
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;

fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

#[derive(Debug, Clone)]
pub struct MimoTtsOptions {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub voice: String,
}

impl Default for MimoTtsOptions {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.xiaomimimo.com/v1".into(),
            model: "mimo-v2.5-tts".into(),
            voice: "default".into(),
        }
    }
}

#[derive(Debug)]
pub struct MimoTtsEngine {
    opts: MimoTtsOptions,
    client: reqwest::Client,
}

impl MimoTtsEngine {
    pub fn new(opts: MimoTtsOptions) -> Self {
        Self {
            opts,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl TtsEngine for MimoTtsEngine {
    fn kind(&self) -> TtsProviderKind {
        TtsProviderKind::Mimo
    }

    async fn synthesize(&self, req: &TtsRequest) -> DramaxisResult<TtsOutcome> {
        let base_url = self.opts.base_url.trim_end_matches('/');
        let url = if base_url.contains("/audio/speech") || base_url.contains("/t2a") {
            base_url.to_string()
        } else {
            format!("{}/audio/speech", base_url)
        };
        let speed = (100 + req.rate_percent).clamp(50, 150) as f64 / 100.0;
        let voice = req.voice.clone().unwrap_or_else(|| self.opts.voice.clone());

        let body = serde_json::json!({
            "model": self.opts.model,
            "input": req.text,
            "voice": voice,
            "response_format": "mp3",
            "speed": speed,
        });

        let mut req_builder = self.client.post(&url);
        if !self.opts.api_key.is_empty() {
            req_builder = req_builder.bearer_auth(&self.opts.api_key);
        }

        let resp = req_builder
            .json(&body)
            .send()
            .await
            .map_err(|e| tts_err(TtsProviderKind::Mimo, format!("request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(tts_err(
                TtsProviderKind::Mimo,
                format!("HTTP {status}: {}", crate::truncate(&text, 300)),
            ));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| tts_err(TtsProviderKind::Mimo, format!("read body: {e}")))?;

        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&bytes) {
            if let Some(audio_hex) = val.get("audio_file").and_then(|v| v.as_str()) {
                if let Some(raw_audio) = decode_hex(audio_hex) {
                    let n = write_output(&req.output_path, &raw_audio).await?;
                    return Ok(TtsOutcome {
                        bytes_written: n,
                        format: "mp3",
                    });
                }
            }
            if let Some(data) = val
                .get("data")
                .and_then(|v| v.get("audio"))
                .and_then(|v| v.as_str())
            {
                if let Some(raw_audio) = decode_hex(data) {
                    let n = write_output(&req.output_path, &raw_audio).await?;
                    return Ok(TtsOutcome {
                        bytes_written: n,
                        format: "mp3",
                    });
                }
            }
        }

        let n = write_output(&req.output_path, &bytes).await?;
        Ok(TtsOutcome {
            bytes_written: n,
            format: "mp3",
        })
    }
}
