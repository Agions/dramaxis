//! dramaxis v1.1.0 · FFmpeg 智能拆条与镜头检测 Tauri 命令

use dramaxis_core::error::SplicrError;
use dramaxis_detect::{
    Ffmpeg, FfmpegProbe, HardwareAccelerationKind, SceneCut, SceneRagEngine, SceneVisualFeature,
};
use std::path::Path;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectScenesResult {
    pub cuts: Vec<SceneCut>,
    pub total_cuts: usize,
    pub probe: Option<FfmpegProbe>,
}

/// 执行 FFmpeg 场景探测切点 (select+showinfo) 与 ffprobe 音视频元数据探测
#[tauri::command]
pub async fn detect_scenes(
    file_path: String,
    threshold: Option<f64>,
) -> Result<DetectScenesResult, SplicrError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(SplicrError::InvalidInput(format!(
            "视频文件不存在: {file_path}"
        )));
    }

    let thresh = threshold.unwrap_or(0.3);

    // 尝试寻找 PATH 中的 ffmpeg
    if let Ok(ffmpeg) = Ffmpeg::discover() {
        let probe = ffmpeg.probe(path).await.ok();
        let cuts = ffmpeg.detect_scenes(path, thresh).await.unwrap_or_default();
        let total = cuts.len();

        Ok(DetectScenesResult {
            cuts,
            total_cuts: total,
            probe,
        })
    } else {
        Err(SplicrError::Ffmpeg(
            "FFmpeg 未安装或不在 PATH 中，请安装 FFmpeg 后重试".into(),
        ))
    }
}

/// 探测当前系统的 GPU 硬件加速编解码器支持
#[tauri::command]
pub async fn detect_hardware_acceleration() -> Result<Vec<HardwareAccelerationKind>, SplicrError> {
    if let Ok(ffmpeg) = Ffmpeg::discover() {
        Ok(ffmpeg.probe_hardware_acceleration().await)
    } else {
        Err(SplicrError::Ffmpeg(
            "FFmpeg 未安装或不在 PATH 中，请安装 FFmpeg 后重试".into(),
        ))
    }
}

/// 执行多模态视听感知与 Scene-RAG 镜头特征提取
#[tauri::command]
pub async fn detect_analyze_scenes_rag(
    file_path: String,
    cuts: Option<Vec<f64>>,
) -> Result<Vec<SceneVisualFeature>, SplicrError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(SplicrError::InvalidInput(format!(
            "视频文件不存在: {file_path}"
        )));
    }

    let ffmpeg = Ffmpeg::discover()
        .map_err(|_| SplicrError::Ffmpeg("FFmpeg 未安装或不在 PATH 中".into()))?;

    let probe = ffmpeg.probe(path).await.ok();
    let total_duration = probe.as_ref().map(|p| p.duration_seconds).unwrap_or(60.0);

    let cut_list = match cuts {
        Some(c) if !c.is_empty() => c,
        _ => ffmpeg.detect_scenes(path, 0.3).await.unwrap_or_default(),
    };

    let engine = SceneRagEngine::new();
    let features = engine.analyze_scenes(&cut_list, total_duration, None);
    Ok(features)
}
