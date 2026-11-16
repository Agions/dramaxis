//! Microsoft Edge 免费 WebSocket TTS 引擎

use crate::{tts_err, write_output, TtsEngine, TtsOutcome, TtsProviderKind, TtsRequest};
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;
use futures::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;

const EDGE_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_URL: &str =
    "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

#[derive(Debug, Clone)]
pub struct EdgeTtsOptions {
    pub voice: String,
}

impl Default for EdgeTtsOptions {
    fn default() -> Self {
        Self {
            voice: "zh-CN-XiaoxiaoNeural".into(),
        }
    }
}

#[derive(Debug)]
pub struct EdgeTtsEngine {
    opts: EdgeTtsOptions,
}

impl EdgeTtsEngine {
    pub fn new(opts: EdgeTtsOptions) -> Self {
        Self { opts }
    }

    pub fn build_ssml(&self, req: &TtsRequest) -> String {
        let voice = req.voice.clone().unwrap_or_else(|| self.opts.voice.clone());
        let rp = req.rate_percent.clamp(-50, 50);
        let rate = format!("{}{}%", if rp >= 0 { "+" } else { "" }, rp);
        format!(
            "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>\
             <voice name='{voice}'>\
             <prosody pitch='+0Hz' rate='{rate}' volume='+0%'>{text}</prosody>\
             </voice></speak>",
            text = escape_xml(&req.text),
        )
    }
}

pub fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\'', "&apos;")
        .replace('"', "&quot;")
}

fn now_http_date() -> String {
    chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string()
}

fn random_connection_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let n = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:032x}", n)
}

#[async_trait]
impl TtsEngine for EdgeTtsEngine {
    fn kind(&self) -> TtsProviderKind {
        TtsProviderKind::Edge
    }

    async fn synthesize(&self, req: &TtsRequest) -> DramaxisResult<TtsOutcome> {
        let conn_id = random_connection_id();
        let url = format!("{EDGE_URL}?TrustedClientToken={EDGE_TOKEN}&ConnectionId={conn_id}");

        let (ws, _resp) = tokio_tungstenite::connect_async(&url)
            .await
            .map_err(|e| tts_err(TtsProviderKind::Edge, format!("websocket connect: {e}")))?;
        let (mut tx, mut rx) = ws.split();

        let config_msg = format!(
            "X-Timestamp:{ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n\
             {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":\
             {{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"}},\
             \"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}\r\n",
            ts = now_http_date(),
        );
        tx.send(Message::Text(config_msg))
            .await
            .map_err(|e| tts_err(TtsProviderKind::Edge, format!("send config: {e}")))?;

        let ssml_msg = format!(
            "X-RequestId:{conn_id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{ts}\r\nPath:ssml\r\n\r\n{ssml}",
            ts = now_http_date(),
            ssml = self.build_ssml(req),
        );
        tx.send(Message::Text(ssml_msg))
            .await
            .map_err(|e| tts_err(TtsProviderKind::Edge, format!("send ssml: {e}")))?;

        let mut audio: Vec<u8> = Vec::new();
        loop {
            let msg = rx
                .next()
                .await
                .ok_or_else(|| tts_err(TtsProviderKind::Edge, "stream closed before turn.end"))?
                .map_err(|e| tts_err(TtsProviderKind::Edge, format!("websocket: {e}")))?;

            match msg {
                Message::Text(t) if t.contains("Path:turn.end") => break,
                Message::Binary(b) => {
                    if b.len() < 2 {
                        continue;
                    }
                    let header_len = u16::from_be_bytes([b[0], b[1]]) as usize;
                    let audio_start = 2 + header_len;
                    if audio_start < b.len() {
                        audio.extend_from_slice(&b[audio_start..]);
                    }
                }
                Message::Close(_) => {
                    return Err(tts_err(
                        TtsProviderKind::Edge,
                        "server closed before synthesis finished",
                    ))
                }
                _ => {}
            }
        }

        if audio.is_empty() {
            return Err(tts_err(TtsProviderKind::Edge, "empty audio payload"));
        }
        let n = write_output(&req.output_path, &audio).await?;
        Ok(TtsOutcome {
            bytes_written: n,
            format: "mp3",
        })
    }
}
