//! 媒体探针与硬件加速识别 (Media Probe & Hardware Acceleration)

use dramaxis_core::error::{DramaxisError, DramaxisResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// ffprobe 探针结果。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegProbe {
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub size_bytes: u64,
}

/// GPU 硬件加速类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HardwareAccelerationKind {
    VideoToolbox,
    Nvenc,
    Qsv,
    Amf,
    Vaapi,
    None,
}

/// 场景切点 (秒)。
pub type SceneCut = f64;

impl crate::ffmpeg::Ffmpeg {
    /// 探针:提取媒体元数据。
    pub async fn probe(&self, path: &Path) -> DramaxisResult<FfmpegProbe> {
        if !path.exists() {
            return Err(DramaxisError::Ffmpeg(format!(
                "输入文件不存在: {}",
                path.display()
            )));
        }

        let output = tokio::process::Command::new(&self.ffprobe_bin)
            .args([
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
            ])
            .arg(path)
            .output()
            .await
            .map_err(|e| DramaxisError::Ffmpeg(format!("ffprobe 进程启动失败: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DramaxisError::Ffmpeg(format!(
                "ffprobe 失败 (code {:?}): {}",
                output.status.code(),
                stderr.trim()
            )));
        }

        let json = String::from_utf8_lossy(&output.stdout);
        parse_probe_json(&json)
    }
}

/// 解析 `ffprobe -print_format json` 的输出。
pub fn parse_probe_json(json: &str) -> DramaxisResult<FfmpegProbe> {
    let parsed: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| DramaxisError::Ffmpeg(format!("解析 ffprobe json 失败: {e}")))?;

    let streams = parsed["streams"]
        .as_array()
        .ok_or_else(|| DramaxisError::Ffmpeg("ffprobe 缺少 streams".into()))?;

    let video_stream = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("video"));
    let audio_stream = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("audio"));

    let video = video_stream.ok_or_else(|| DramaxisError::Ffmpeg("未找到视频流".into()))?;

    let width = video["width"]
        .as_u64()
        .ok_or_else(|| DramaxisError::Ffmpeg("视频流缺少 width".into()))? as u32;
    let height = video["height"]
        .as_u64()
        .ok_or_else(|| DramaxisError::Ffmpeg("视频流缺少 height".into()))? as u32;

    let format = &parsed["format"];
    let duration_str = format["duration"]
        .as_str()
        .or_else(|| video["duration"].as_str());

    let duration_seconds = duration_str
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let size_bytes = format["size"]
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let video_codec = video["codec_name"].as_str().map(|s| s.to_string());
    let audio_codec = audio_stream
        .and_then(|a| a["codec_name"].as_str())
        .map(|s| s.to_string());

    Ok(FfmpegProbe {
        duration_seconds,
        width,
        height,
        video_codec,
        audio_codec,
        size_bytes,
    })
}
