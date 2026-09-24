//! src-tauri 命令 · 视频导出与剪映草稿交付
//!
//! - export_plan: 按 quick/custom/silent 模式生成导出计划 (ffmpeg 参数)
//! - export_validate_params: 校验自定义编码参数 (分辨率/fps/码率/codec×container)
//! - export_render_subtitles: 渲染 SRT/ASS/VTT 字幕文本
//! - video_build_plans: 按 single/concat/batch/series 策略生成多视频编排计划
//! - export_capcut_draft: 导出剪映工程草稿 (.draft 完整多轨与材料)
//! - export_render_video: 直接使用 FFmpeg 压制渲染包含微缩放/环境模糊/配音/字幕的 MP4 视频

use std::path::{Path, PathBuf};

use splicr_core::domain::{ExportStrategy, ProjectSettings};
use splicr_core::error::SplicrError;
use splicr_detect::Ffmpeg;
pub use splicr_export::capcut::{CapcutDraftOptions, CapcutDraftResult, CapcutSubtitleItem};
use splicr_export::{
    create_capcut_draft, render_subtitles, validate_params, ExportMode, ExportParams, ExportPlan,
    ExportPlanner, SubtitleFormat, SubtitleItem,
};
use splicr_intake::{build_plans, OutputPlan, PlanOptions};
use tauri::{Emitter, Manager};

/// 按模式生成导出计划。custom 模式必须携带 settings。
#[tauri::command]
pub async fn export_plan(
    mode: ExportMode,
    settings: Option<ProjectSettings>,
) -> Result<ExportPlan, SplicrError> {
    ExportPlanner::new()
        .plan(mode, settings.as_ref())
        .map_err(|e| SplicrError::InvalidInput(e.to_string()))
}

/// 校验自定义编码参数 (前端"高级导出"表单即时校验用)
#[tauri::command]
pub async fn export_validate_params(params: ExportParams) -> Result<(), SplicrError> {
    validate_params(&params).map_err(|e| SplicrError::InvalidInput(e.to_string()))
}

/// 渲染字幕文本 (SRT / ASS / VTT),条目时间区间倒挂返回错误
#[tauri::command]
pub async fn export_render_subtitles(
    items: Vec<SubtitleItem>,
    format: SubtitleFormat,
) -> Result<String, SplicrError> {
    render_subtitles(&items, format).map_err(|e| SplicrError::InvalidInput(e.to_string()))
}

/// 按 4 策略生成多视频编排计划。options 缺省用 PlanOptions::default()。
#[tauri::command]
pub async fn video_build_plans(
    sources: Vec<PathBuf>,
    strategy: ExportStrategy,
    options: Option<PlanOptions>,
) -> Result<Vec<OutputPlan>, SplicrError> {
    let opts = options.unwrap_or_default();
    build_plans(&sources, strategy, &opts).map_err(|e| SplicrError::InvalidInput(e.to_string()))
}

/// 导出剪映工程草稿 (.draft 完整多轨与材料)
#[tauri::command]
pub async fn export_capcut_draft(
    params: CapcutDraftOptions,
) -> Result<CapcutDraftResult, SplicrError> {
    create_capcut_draft(params)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderVideoParams {
    pub video_path: String,
    #[serde(default)]
    pub voice_path: Option<String>,
    #[serde(default)]
    pub subtitles: Vec<CapcutSubtitleItem>,
    #[serde(default)]
    pub platform_preset: Option<String>,
    #[serde(default)]
    pub anti_dup_zoom: Option<f64>,
    #[serde(default)]
    pub enable_ambient_blur: Option<bool>,
    #[serde(default)]
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderVideoResult {
    pub output_path: String,
    pub duration_seconds: f64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgressPayload {
    pub percent: f64,
    pub time_seconds: f64,
    pub phase: String,
}

fn format_srt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1000;
    let rem_ms = ms % 1000;
    format!("{h:02}:{m:02}:{s:02},{rem_ms:03}")
}

/// 直接使用 FFmpeg 压制渲染包含防重微缩放/环境高斯模糊/配音/字幕的完整 MP4 视频
#[tauri::command]
pub async fn export_render_video(
    app_handle: tauri::AppHandle,
    params: RenderVideoParams,
) -> Result<RenderVideoResult, SplicrError> {
    let video_p = Path::new(&params.video_path);
    if !video_p.exists() {
        return Err(SplicrError::InvalidInput(format!(
            "视频素材源文件不存在: {}",
            params.video_path
        )));
    }

    let ffmpeg = Ffmpeg::discover()?;
    let probe = ffmpeg.probe(video_p).await?;
    let total_duration = probe.duration_seconds.max(1.0);

    // 1. 目标分辨率与版式判断
    let preset = params.platform_preset.unwrap_or_else(|| "douyin".into());
    let is_landscape = preset.to_lowercase().contains("bilibili")
        || preset.to_lowercase().contains("16:9")
        || preset.to_lowercase().contains("youtube");

    // 2. 目标输出文件
    let output_file: PathBuf = if let Some(out) = params.output_path {
        PathBuf::from(out)
    } else {
        let download_dir = app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        let filename = format!(
            "splicr_{}_{}.mp4",
            preset.to_lowercase().replace([' ', '/'], "_"),
            chrono::Utc::now().timestamp_millis()
        );
        download_dir.join(filename)
    };

    if let Some(parent) = output_file.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    // 3. 字幕临时文件构建
    let temp_srt = if !params.subtitles.is_empty() {
        let srt_path = std::env::temp_dir().join(format!(
            "splicr_temp_sub_{}.srt",
            chrono::Utc::now().timestamp_micros()
        ));
        let mut srt_content = String::new();
        for (idx, sub) in params.subtitles.iter().enumerate() {
            let start_ms = (sub.start * 1000.0) as u64;
            let end_ms = (sub.end * 1000.0) as u64;
            srt_content.push_str(&format!(
                "{}\n{} --> {}\n{}\n\n",
                idx + 1,
                format_srt_time(start_ms),
                format_srt_time(end_ms),
                sub.text
            ));
        }
        let _ = tokio::fs::write(&srt_path, srt_content).await;
        Some(srt_path)
    } else {
        None
    };

    // 4. 滤镜图谱 (Filter Complex) 构建
    let zoom = params.anti_dup_zoom.unwrap_or(1.03).clamp(1.0, 1.15);
    let enable_blur = params.enable_ambient_blur.unwrap_or(true);

    let mut filter_complex = String::new();

    // 4.1 画面缩放与高斯模糊
    if is_landscape {
        filter_complex.push_str(
            "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        );
    } else if enable_blur {
        // 9:16 竖屏高斯模糊底衬
        filter_complex.push_str(
            "[0:v]split=2[vbg][vfg];[vbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[vbgblur];[vfg]scale=1080:1920:force_original_aspect_ratio=decrease[vfgscaled];[vbgblur][vfgscaled]overlay=(W-w)/2:(H-h)/2[vbase];"
        );
    } else {
        filter_complex.push_str(
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        );
    }

    // 4.2 动态微缩放
    let current_v = if (zoom - 1.0).abs() > 0.001 {
        let (tw, th) = if is_landscape {
            (1920, 1080)
        } else {
            (1080, 1920)
        };
        let zw = (((tw as f64) * zoom) as u32 / 2) * 2;
        let zh = (((th as f64) * zoom) as u32 / 2) * 2;
        filter_complex.push_str(&format!("[vbase]scale={zw}:{zh},crop={tw}:{th}[vzoomed];"));
        "[vzoomed]"
    } else {
        "[vbase]"
    };

    // 4.3 字幕烧录
    let v_final_tag = if let Some(ref srt) = temp_srt {
        let escaped = srt
            .to_string_lossy()
            .replace(':', "\\:")
            .replace('\'', "\\'");
        filter_complex.push_str(&format!(
            "{current_v}subtitles='{escaped}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2'[vsub];"
        ));
        "[vsub]"
    } else {
        current_v
    };

    // 4.4 音频混流
    let mut has_narration = false;
    let voice_path_str = if let Some(v_path) = &params.voice_path {
        if Path::new(v_path).exists() {
            has_narration = true;
            Some(v_path.clone())
        } else {
            None
        }
    } else {
        None
    };

    let a_final_tag = if has_narration {
        let has_orig_audio = probe.audio_codec.is_some();
        if has_orig_audio {
            filter_complex.push_str(
                "[0:a]volume=0.15[a_orig];[1:a]volume=1.0[a_voice];[a_orig][a_voice]amix=inputs=2:duration=first[aout]"
            );
            "[aout]"
        } else {
            "[1:a]"
        }
    } else if probe.audio_codec.is_some() {
        "[0:a]"
    } else {
        ""
    };

    // 5. 拼装 FFmpeg 参数并执行
    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), params.video_path.clone()];

    if let Some(voice) = &voice_path_str {
        args.push("-i".into());
        args.push(voice.clone());
    }

    // 去掉尾部分号
    let fc_cleaned = filter_complex.trim_end_matches(';').to_string();
    if !fc_cleaned.is_empty() {
        args.push("-filter_complex".into());
        args.push(fc_cleaned);
        args.push("-map".into());
        args.push(v_final_tag.into());
        if !a_final_tag.is_empty() {
            args.push("-map".into());
            args.push(a_final_tag.into());
        }
    }

    args.extend([
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "veryfast".into(),
        "-crf".into(),
        "21".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        output_file.to_string_lossy().to_string(),
    ]);

    let args_str_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let app_clone = app_handle.clone();
    let on_progress = Box::new(move |secs: f64, _p: Option<u8>| {
        let pct = (secs / total_duration * 100.0).clamp(0.0, 99.0);
        let _ = app_clone.emit(
            "export://progress",
            RenderProgressPayload {
                percent: pct,
                time_seconds: secs,
                phase: "rendering".into(),
            },
        );
    });

    let encode_res = ffmpeg.run_encode(&args_str_refs, Some(&*on_progress)).await;

    // 清理临时字幕文件
    if let Some(ref srt) = temp_srt {
        let _ = tokio::fs::remove_file(srt).await;
    }

    encode_res?;

    let size_bytes = tokio::fs::metadata(&output_file)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let _ = app_handle.emit(
        "export://progress",
        RenderProgressPayload {
            percent: 100.0,
            time_seconds: total_duration,
            phase: "completed".into(),
        },
    );

    Ok(RenderVideoResult {
        output_path: output_file.to_string_lossy().to_string(),
        duration_seconds: total_duration,
        size_bytes,
    })
}
