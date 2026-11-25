//! dramaxis-subtitle::asr · 原片听觉理解与 ASR 语音转写引擎
//!
//! ## 核心定位 (P0-1)
//! 彻底解决影视解说中“编剧 Agent 听不到原片台词”的致命短板，按 Local-First 优先级提供三级转写链路：
//! 1. **伴随字幕直读**：自动发现同目录 `<stem>.srt` 字幕文件，零延迟解析；
//! 2. **本地离线 `whisper-cli` (`whisper.cpp`)**：通过 `MediaScheduler(ResourceSlot::Asr)` 并发背压与
//!    `CancelToken` 子进程级取消，离线零成本提取带毫秒时间戳的原片台词流；
//! 3. **OpenAI 兼容 Whisper / SenseVoice HTTP 接口**：支持局域网 GPU 算力节点或云端 API。
//!
//! 若上述通道均未就绪，则以 `tracing::warn!` 明确降级为空结果，严禁静默伪造假台词。

use crate::SubtitleError;
use async_trait::async_trait;
use dramaxis_core::{CancelToken, MediaScheduler, ResourceSlot};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

/// 原片单条 ASR 台词片段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    #[serde(default)]
    pub speaker: Option<String>,
    #[serde(default)]
    pub confidence: Option<f32>,
    /// 是否为适合“原声金句穿插”的高冲突/高情感对白
    #[serde(default)]
    pub is_golden_quote: bool,
}

/// 原片完整 ASR 转写产物
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptResult {
    pub segments: Vec<TranscriptSegment>,
    pub provider: String,
    pub language: String,
    pub full_text: String,
}

impl TranscriptResult {
    /// 从台词段列表构建汇总结果并自动标注原声金句候选
    pub fn from_segments(
        mut segments: Vec<TranscriptSegment>,
        provider: impl Into<String>,
        language: impl Into<String>,
    ) -> Self {
        for seg in &mut segments {
            seg.is_golden_quote = detect_golden_quote(seg);
        }
        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        Self {
            segments,
            provider: provider.into(),
            language: language.into(),
            full_text,
        }
    }

    /// 格式化为注入编剧 Agent Prompt 的带时间戳原片台词上下文
    pub fn to_prompt_context(&self, max_chars: usize) -> String {
        if self.segments.is_empty() {
            return String::new();
        }
        let mut out = String::new();
        for seg in &self.segments {
            let tag = if seg.is_golden_quote {
                " ★金句"
            } else {
                ""
            };
            let line = format!(
                "[{:.1}s-{:.1}s{}] {}\n",
                seg.start_sec, seg.end_sec, tag, seg.text
            );
            if out.chars().count() + line.chars().count() > max_chars {
                out.push_str("...(后续原片台词已截断)\n");
                break;
            }
            out.push_str(&line);
        }
        out
    }

    /// 提取适合在解说中穿插保留原声的“金句对白”候选池
    pub fn golden_quotes(&self) -> Vec<&TranscriptSegment> {
        self.segments.iter().filter(|s| s.is_golden_quote).collect()
    }
}

/// 启发式识别原片中的高情绪/强冲突金句（时长 1.5s~6.5s 且含情绪标点或戏剧冲突词）
fn detect_golden_quote(seg: &TranscriptSegment) -> bool {
    let dur = seg.end_sec - seg.start_sec;
    if !(1.2..=6.8).contains(&dur) {
        return false;
    }
    let t = seg.text.trim();
    if t.chars().count() < 4 {
        return false;
    }
    let has_strong_punct =
        t.contains('！') || t.contains('!') || t.contains('？') || t.contains('?');
    let dramatic_keywords = [
        "滚",
        "绝不",
        "后悔",
        "凭什么",
        "不可能",
        "真相",
        "背叛",
        "离婚",
        "原来",
        "竟然",
        "死",
        "救命",
        "跪下",
        "秘密",
        "没想到",
    ];
    has_strong_punct || dramatic_keywords.iter().any(|kw| t.contains(kw))
}

/// ASR 引擎配置（支持本地 whisper.cpp 与远端/局域网 OpenAI 兼容端点）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrConfig {
    pub whisper_cli_path: Option<PathBuf>,
    pub whisper_model_path: Option<PathBuf>,
    pub api_base_url: Option<String>,
    pub api_key: Option<String>,
    pub api_model: String,
    pub language: String,
}

impl Default for AsrConfig {
    fn default() -> Self {
        Self {
            whisper_cli_path: None,
            whisper_model_path: None,
            api_base_url: None,
            api_key: None,
            api_model: "whisper-1".into(),
            language: "zh".into(),
        }
    }
}

/// 统一 ASR 算子抽象 Trait
#[async_trait]
pub trait AsrProvider: Send + Sync {
    async fn transcribe(
        &self,
        media_path: &Path,
        cancel: &CancelToken,
    ) -> Result<TranscriptResult, SubtitleError>;
}

/// 多通道自动降级 ASR 引擎
#[derive(Debug, Clone)]
pub struct AutoAsrEngine {
    pub config: AsrConfig,
}

impl AutoAsrEngine {
    pub fn new(config: AsrConfig) -> Self {
        Self { config }
    }

    /// 尝试发现并解析同目录伴随 `.srt` 字幕
    fn try_load_sidecar_srt(&self, media_path: &Path) -> Option<TranscriptResult> {
        let srt_path = media_path.with_extension("srt");
        if !srt_path.exists() {
            return None;
        }
        let raw = std::fs::read_to_string(&srt_path).ok()?;
        let segments = parse_srt_transcript(&raw);
        if segments.is_empty() {
            return None;
        }
        tracing::info!(
            "ASR 命中伴随字幕文件 {:?}，共解析 {} 条原片台词",
            srt_path,
            segments.len()
        );
        Some(TranscriptResult::from_segments(
            segments,
            "sidecar_srt",
            self.config.language.clone(),
        ))
    }

    /// 抽取 16kHz 单声道 WAV 供本地/远端 Whisper 消费
    async fn extract_16k_wav(
        &self,
        media_path: &Path,
        cancel: &CancelToken,
    ) -> Result<PathBuf, SubtitleError> {
        let _permit = MediaScheduler::global()
            .acquire_cancellable(ResourceSlot::Ffmpeg, cancel)
            .await
            .ok_or_else(|| SubtitleError::AsrError("音频抽取已取消".into()))?;

        let out_wav = std::env::temp_dir().join(format!(
            "dramaxis_asr_{}.wav",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));

        let mut cmd = Command::new("ffmpeg");
        cmd.args([
            "-y",
            "-i",
            &media_path.to_string_lossy(),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            &out_wav.to_string_lossy(),
        ]);

        let output = cancel
            .run_command(&mut cmd)
            .await
            .map_err(|e| SubtitleError::AsrError(format!("FFmpeg 启动失败: {e}")))?
            .ok_or_else(|| SubtitleError::AsrError("音频抽取被用户取消".into()))?;

        if !output.status.success() || !out_wav.exists() {
            return Err(SubtitleError::AsrError(format!(
                "FFmpeg 抽取 16kHz 音频失败: {}",
                String::from_utf8_lossy(&output.stderr)
                    .lines()
                    .last()
                    .unwrap_or("unknown")
            )));
        }
        Ok(out_wav)
    }

    /// 通道 2：调用本地 `whisper-cli` / `whisper-cpp`
    async fn try_local_whisper_cli(
        &self,
        media_path: &Path,
        cancel: &CancelToken,
    ) -> Option<TranscriptResult> {
        let model_path = self.config.whisper_model_path.as_ref()?;
        if !model_path.exists() {
            return None;
        }
        let cli_bin = self
            .config
            .whisper_cli_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "whisper-cli".to_string());

        let wav_path = self.extract_16k_wav(media_path, cancel).await.ok()?;
        let _asr_permit = MediaScheduler::global()
            .acquire_cancellable(ResourceSlot::Asr, cancel)
            .await?;

        let out_prefix = wav_path.with_extension("out");
        let mut cmd = Command::new(&cli_bin);
        cmd.args([
            "-m",
            &model_path.to_string_lossy(),
            "-f",
            &wav_path.to_string_lossy(),
            "-l",
            &self.config.language,
            "-osrt",
            "-of",
            &out_prefix.to_string_lossy(),
        ]);

        let run_res = cancel.run_command(&mut cmd).await;
        let _ = std::fs::remove_file(&wav_path);

        let Ok(Some(output)) = run_res else {
            return None;
        };
        if !output.status.success() {
            tracing::warn!(
                "本地 whisper-cli 执行失败: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            return None;
        }

        let srt_file = PathBuf::from(format!("{}.srt", out_prefix.to_string_lossy()));
        let raw = std::fs::read_to_string(&srt_file).ok()?;
        let _ = std::fs::remove_file(&srt_file);

        let segments = parse_srt_transcript(&raw);
        if segments.is_empty() {
            return None;
        }
        tracing::info!("本地 whisper-cli 成功提取 {} 条原片台词", segments.len());
        Some(TranscriptResult::from_segments(
            segments,
            "whisper_cli_local",
            self.config.language.clone(),
        ))
    }

    /// 通道 3：调用 OpenAI 兼容 Whisper HTTP API（支持局域网 Faster-Whisper / 云端 API）
    async fn try_http_whisper_api(
        &self,
        media_path: &Path,
        cancel: &CancelToken,
    ) -> Option<TranscriptResult> {
        let base_url = self.config.api_base_url.as_ref()?.trim_end_matches('/');
        if base_url.is_empty() {
            return None;
        }

        let wav_path = self.extract_16k_wav(media_path, cancel).await.ok()?;
        let audio_bytes = tokio::fs::read(&wav_path).await.ok();
        let _ = std::fs::remove_file(&wav_path);
        let audio_bytes = audio_bytes?;

        let _permit = MediaScheduler::global()
            .acquire_cancellable(ResourceSlot::Asr, cancel)
            .await?;

        // 手工构造标准 multipart/form-data 请求体（零额外 reqwest feature 依赖）
        let boundary = "----DramaxisAsrBoundary7MA4YWxkTrZu0gW";
        let mut body: Vec<u8> = Vec::with_capacity(audio_bytes.len() + 1024);

        let append_field = |buf: &mut Vec<u8>, name: &str, val: &str| {
            buf.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            buf.extend_from_slice(
                format!("Content-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n")
                    .as_bytes(),
            );
        };
        append_field(&mut body, "model", &self.config.api_model);
        append_field(&mut body, "language", &self.config.language);
        append_field(&mut body, "response_format", "srt");

        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(
            b"Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n",
        );
        body.extend_from_slice(&audio_bytes);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

        let url = format!("{base_url}/audio/transcriptions");
        let client = reqwest::Client::new();
        let mut req = client
            .post(&url)
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(body);

        if let Some(key) = self.config.api_key.as_ref().filter(|k| !k.is_empty()) {
            req = req.bearer_auth(key);
        }

        let resp = tokio::select! {
            biased;
            _ = cancel.cancelled() => return None,
            r = req.send() => r.ok()?,
        };

        if !resp.status().is_success() {
            tracing::warn!("Whisper HTTP API 返回状态码 {}", resp.status());
            return None;
        }
        let srt_text = resp.text().await.ok()?;
        let segments = parse_srt_transcript(&srt_text);
        if segments.is_empty() {
            return None;
        }
        tracing::info!("Whisper HTTP API 成功提取 {} 条原片台词", segments.len());
        Some(TranscriptResult::from_segments(
            segments,
            "whisper_http_api",
            self.config.language.clone(),
        ))
    }
}

#[async_trait]
impl AsrProvider for AutoAsrEngine {
    async fn transcribe(
        &self,
        media_path: &Path,
        cancel: &CancelToken,
    ) -> Result<TranscriptResult, SubtitleError> {
        if cancel.is_cancelled() {
            return Err(SubtitleError::AsrError("ASR 任务已取消".into()));
        }

        // 1. 优先读取伴随 SRT 字幕
        if let Some(res) = self.try_load_sidecar_srt(media_path) {
            return Ok(res);
        }

        // 2. 尝试本地离线 whisper-cli
        if media_path.exists() {
            if let Some(res) = self.try_local_whisper_cli(media_path, cancel).await {
                return Ok(res);
            }

            // 3. 尝试远端 / 局域网 OpenAI 兼容 Whisper API
            if let Some(res) = self.try_http_whisper_api(media_path, cancel).await {
                return Ok(res);
            }
        }

        // 4. 明确降级（严禁静默伪造假台词）
        tracing::warn!(
            "未检测到伴随 SRT、本地 whisper-cli 模型或 Whisper API 配置，原片 ASR 台词转写降级为空 (media={:?})",
            media_path
        );
        Ok(TranscriptResult {
            segments: Vec::new(),
            provider: "none_fallback".into(),
            language: self.config.language.clone(),
            full_text: String::new(),
        })
    }
}

/// 解析标准 SRT 文本为结构化 `TranscriptSegment` 列表（兼容 UTF-8 BOM、CRLF 与多行台词）
pub fn parse_srt_transcript(raw: &str) -> Vec<TranscriptSegment> {
    let cleaned = raw.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    let mut segments = Vec::new();

    for block in cleaned.split("\n\n") {
        let lines: Vec<&str> = block
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .collect();
        if lines.len() < 2 {
            continue;
        }

        // 查找包含 `-->` 的时间轴行
        let Some(ts_idx) = lines.iter().position(|l| l.contains("-->")) else {
            continue;
        };
        let parts: Vec<&str> = lines[ts_idx].split("-->").collect();
        if parts.len() != 2 {
            continue;
        }
        let Some(start_sec) = parse_srt_ts(parts[0].trim()) else {
            continue;
        };
        let Some(end_sec) = parse_srt_ts(parts[1].trim()) else {
            continue;
        };
        let text = lines[ts_idx + 1..].join(" ").trim().to_string();
        if text.is_empty() || end_sec <= start_sec {
            continue;
        }

        let mut seg = TranscriptSegment {
            start_sec,
            end_sec,
            text,
            speaker: None,
            confidence: None,
            is_golden_quote: false,
        };
        seg.is_golden_quote = detect_golden_quote(&seg);
        segments.push(seg);
    }

    segments
}

fn parse_srt_ts(ts: &str) -> Option<f64> {
    let normalized = ts.replace(',', ".");
    let parts: Vec<&str> = normalized.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let s: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_srt_and_golden_quote_detection() {
        let sample = "\u{feff}1\r\n00:00:01,200 --> 00:00:03,800\r\n别碰我，这辈子我绝不原谅你！\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,500\r\n天气不错，我们去吃饭吧。\r\n\r\n3\r\n00:00:07,000 --> 00:00:10,200\r\n你凭什么以为我会签下这份离婚协议？\r\n";
        let segs = parse_srt_transcript(sample);
        assert_eq!(segs.len(), 3);
        assert!((segs[0].start_sec - 1.2).abs() < 1e-3);
        assert!(segs[0].is_golden_quote, "强冲突台词应识别为原声金句");
        assert!(!segs[1].is_golden_quote, "普通日常台词不应误判为金句");
        assert!(segs[2].is_golden_quote, "反问+离婚关键词应识别为原声金句");

        let res = TranscriptResult::from_segments(segs, "sidecar_srt", "zh");
        assert_eq!(res.golden_quotes().len(), 2);
        let ctx = res.to_prompt_context(500);
        assert!(ctx.contains("★金句"));
        assert!(ctx.contains("离婚协议"));
    }

    #[tokio::test]
    async fn test_auto_asr_loads_sidecar_srt() {
        let tmp_dir =
            std::env::temp_dir().join(format!("dramaxis_asr_test_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp_dir);
        let mp4 = tmp_dir.join("ep01.mp4");
        let srt = tmp_dir.join("ep01.srt");
        std::fs::write(&mp4, b"dummy").unwrap();
        std::fs::write(&srt, "1\n00:00:00,500 --> 00:00:03,000\n真相终于大白了！\n").unwrap();

        let engine = AutoAsrEngine::new(AsrConfig::default());
        let res = engine
            .transcribe(&mp4, &CancelToken::new())
            .await
            .expect("transcribe");
        assert_eq!(res.provider, "sidecar_srt");
        assert_eq!(res.segments.len(), 1);
        assert!(res.segments[0].is_golden_quote);

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }
}
