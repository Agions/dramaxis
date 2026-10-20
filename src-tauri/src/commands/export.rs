//! src-tauri 命令 · 视频导出、8维消重矩阵与剪映草稿交付
//!
//! - export_plan: 按 quick/custom/silent 模式生成导出计划 (ffmpeg 参数)
//! - export_validate_params: 校验自定义编码参数 (分辨率/fps/码率/codec×container)
//! - export_render_subtitles: 渲染 SRT/ASS/VTT 字幕文本
//! - video_build_plans: 按 single/concat/batch/series 策略生成多视频编排计划
//! - export_capcut_draft: 导出剪映工程草稿 (.draft 完整多轨与材料)
//! - export_get_dedup_preset: 获取轻度/标准/强力 8 维消重矩阵预设
//! - export_render_video: 使用 FFmpeg 压制包含 8 维消重、环境模糊、配音、字幕的 MP4 视频
//! - export_batch_fission: 批量并发生成 N 份参数各异、防指纹碰撞的裂变视频

use std::path::{Path, PathBuf};

use dramaxis_core::domain::{ExportStrategy, ProjectSettings};
use dramaxis_core::error::SplicrError;
use dramaxis_detect::Ffmpeg;
pub use dramaxis_export::capcut::{CapcutDraftOptions, CapcutDraftResult, CapcutSubtitleItem};
pub use dramaxis_export::dedup::{
    generate_fission_variants, DedupIntensity, DedupOptions,
};
use dramaxis_export::{
    create_capcut_draft, render_subtitles, validate_params, ExportMode, ExportParams, ExportPlan,
    ExportPlanner, SubtitleFormat, SubtitleItem,
};
use dramaxis_intake::{build_plans, OutputPlan, PlanOptions};
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

/// 获取 8 维消重矩阵预设 (轻度/标准/强力)
#[tauri::command]
pub async fn export_get_dedup_preset(
    intensity: DedupIntensity,
) -> Result<DedupOptions, SplicrError> {
    Ok(match intensity {
        DedupIntensity::Mild => DedupOptions::mild(),
        DedupIntensity::Standard => DedupOptions::standard(),
        DedupIntensity::Aggressive => DedupOptions::aggressive(),
        DedupIntensity::Custom => DedupOptions::standard(),
    })
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
    pub dedup: Option<DedupOptions>,
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFissionParams {
    pub video_path: String,
    #[serde(default)]
    pub voice_path: Option<String>,
    #[serde(default)]
    pub subtitles: Vec<CapcutSubtitleItem>,
    #[serde(default)]
    pub platform_preset: Option<String>,
    #[serde(default)]
    pub base_dedup: Option<DedupOptions>,
    pub count: u32,
    #[serde(default)]
    pub output_dir: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FissionVariantResult {
    pub index: u32,
    pub output_path: String,
    pub size_bytes: u64,
    pub dedup_options: DedupOptions,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFissionResult {
    pub variants: Vec<FissionVariantResult>,
    pub total_duration_seconds: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FissionProgressPayload {
    pub current_index: u32,
    pub total_count: u32,
    pub percent: f64,
    pub message: String,
}

fn format_srt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1000;
    let rem_ms = ms % 1000;
    format!("{h:02}:{m:02}:{s:02},{rem_ms:03}")
}

/// 内部通用渲染流水线 (支持 8 维消重矩阵、字幕、环境模糊、音画对齐)
async fn render_video_pipeline(
    video_path: &str,
    voice_path: Option<&str>,
    subtitles: &[CapcutSubtitleItem],
    platform_preset: Option<&str>,
    enable_ambient_blur: bool,
    dedup: &DedupOptions,
    output_file: &Path,
    on_progress: Option<Box<dyn Fn(f64) + Send + Sync>>,
) -> Result<(f64, u64), SplicrError> {
    let video_p = Path::new(video_path);
    if !video_p.exists() {
        return Err(SplicrError::InvalidInput(format!(
            "视频素材源文件不存在: {video_path}"
        )));
    }

    let ffmpeg = Ffmpeg::discover()?;
    let probe = ffmpeg.probe(video_p).await?;
    let total_duration = probe.duration_seconds.max(1.0);

    // 1. 目标分辨率与版式判断
    let preset = platform_preset.unwrap_or("douyin");
    let is_landscape = preset.to_lowercase().contains("bilibili")
        || preset.to_lowercase().contains("16:9")
        || preset.to_lowercase().contains("youtube");

    let (tw, th): (u32, u32) = if is_landscape { (1920, 1080) } else { (1080, 1920) };

    if let Some(parent) = output_file.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    // 2. 字幕临时文件构建
    let temp_srt = if !subtitles.is_empty() {
        let srt_path = std::env::temp_dir().join(format!(
            "dramaxis_temp_sub_{}.srt",
            chrono::Utc::now().timestamp_micros()
        ));
        let mut srt_content = String::new();
        for (idx, sub) in subtitles.iter().enumerate() {
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

    // 3. 滤镜图谱 (Filter Complex) 构建
    let mut filter_complex = String::new();

    // 3.1 画面缩放与高斯模糊底衬
    if is_landscape {
        filter_complex.push_str(
            "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        );
    } else if enable_ambient_blur {
        // 9:16 竖屏高斯模糊底衬
        filter_complex.push_str(
            "[0:v]split=2[vbg][vfg];[vbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[vbgblur];[vfg]scale=1080:1920:force_original_aspect_ratio=decrease[vfgscaled];[vbgblur][vfgscaled]overlay=(W-w)/2:(H-h)/2[vbase];"
        );
    } else {
        filter_complex.push_str(
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        );
    }

    // 3.2 8 维消重矩阵视频算子串接 (微缩放、镜像、噪点、抽插帧、微变速)
    let v_filters = dedup.build_video_filters(tw, th);
    let current_v = if !v_filters.is_empty() {
        let chain = v_filters.join(",");
        filter_complex.push_str(&format!("[vbase]{chain}[vdedup];"));
        "[vdedup]"
    } else {
        "[vbase]"
    };

    // 3.3 字幕烧录
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

    // 3.4 音频混流与 8 维消重音频算子 (音高微移、微变速、混响)
    let mut has_narration = false;
    let voice_path_str = if let Some(v_path) = voice_path {
        if Path::new(v_path).exists() {
            has_narration = true;
            Some(v_path.to_string())
        } else {
            None
        }
    } else {
        None
    };

    let a_filters = dedup.build_audio_filters();
    let audio_chain_prefix = if !a_filters.is_empty() {
        format!(",{}", a_filters.join(","))
    } else {
        String::new()
    };

    let a_final_tag = if has_narration {
        let has_orig_audio = probe.audio_codec.is_some();
        if has_orig_audio {
            filter_complex.push_str(&format!(
                "[0:a]volume=0.15[a_orig];[1:a]volume=1.0{audio_chain_prefix}[a_voice];[a_orig][a_voice]amix=inputs=2:duration=first[aout]"
            ));
            "[aout]"
        } else {
            filter_complex.push_str(&format!(
                "[1:a]volume=1.0{audio_chain_prefix}[aout]"
            ));
            "[aout]"
        }
    } else if probe.audio_codec.is_some() {
        if !a_filters.is_empty() {
            filter_complex.push_str(&format!(
                "[0:a]{}[aout]",
                a_filters.join(",")
            ));
            "[aout]"
        } else {
            "[0:a]"
        }
    } else {
        ""
    };

    // 4. 拼装 FFmpeg 参数并执行
    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), video_path.to_string()];

    if let Some(voice) = &voice_path_str {
        args.push("-i".into());
        args.push(voice.clone());
    }

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

    // 8 维元数据擦除与随机编码器签名
    let meta_args = dedup.build_metadata_args("Dramaxis Master", chrono::Utc::now().timestamp_micros() as u64);
    args.extend(meta_args);

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

    let on_progress_wrapper = Box::new(move |secs: f64, _p: Option<u8>| {
        if let Some(ref cb) = on_progress {
            cb(secs);
        }
    });

    let encode_res = ffmpeg.run_encode(&args_str_refs, Some(&*on_progress_wrapper)).await;

    // 清理临时字幕文件
    if let Some(ref srt) = temp_srt {
        let _ = tokio::fs::remove_file(srt).await;
    }

    encode_res?;

    let size_bytes = tokio::fs::metadata(&output_file)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    Ok((total_duration, size_bytes))
}

/// 直接使用 FFmpeg 压制渲染包含 8 维防重/环境高斯模糊/配音/字幕的完整 MP4 视频
#[tauri::command]
pub async fn export_render_video(
    app_handle: tauri::AppHandle,
    params: RenderVideoParams,
) -> Result<RenderVideoResult, SplicrError> {
    let preset = params.platform_preset.as_deref().unwrap_or("douyin");

    let output_file: PathBuf = if let Some(out) = params.output_path {
        PathBuf::from(out)
    } else {
        let download_dir = app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        let filename = format!(
            "dramaxis_{}_{}.mp4",
            preset.to_lowercase().replace([' ', '/'], "_"),
            chrono::Utc::now().timestamp_millis()
        );
        download_dir.join(filename)
    };

    let mut dedup = params.dedup.unwrap_or_default();
    if let Some(z) = params.anti_dup_zoom {
        dedup.enable_zoom = true;
        dedup.zoom_rate = z;
    }

    let enable_blur = params.enable_ambient_blur.unwrap_or(true);
    let app_clone = app_handle.clone();

    let (total_duration, size_bytes) = render_video_pipeline(
        &params.video_path,
        params.voice_path.as_deref(),
        &params.subtitles,
        Some(preset),
        enable_blur,
        &dedup,
        &output_file,
        Some(Box::new(move |secs: f64| {
            let pct = (secs / 60.0 * 100.0).clamp(0.0, 99.0);
            let _ = app_clone.emit(
                "export://progress",
                RenderProgressPayload {
                    percent: pct,
                    time_seconds: secs,
                    phase: "rendering".into(),
                },
            );
        })),
    )
    .await?;

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

/// 批量裂变引擎: 基于 8 维消重矩阵并发/顺序生成 N 份参数各异的防重成片
#[tauri::command]
pub async fn export_batch_fission(
    app_handle: tauri::AppHandle,
    params: BatchFissionParams,
) -> Result<BatchFissionResult, SplicrError> {
    let count = params.count.clamp(1, 20) as usize;
    let base_dedup = params.base_dedup.unwrap_or_default();
    let variants = generate_fission_variants(&base_dedup, count);

    let output_dir: PathBuf = if let Some(dir) = params.output_dir {
        PathBuf::from(dir)
    } else {
        let download_dir = app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        download_dir.join(format!("fission_{}", chrono::Utc::now().timestamp_millis()))
    };

    let _ = tokio::fs::create_dir_all(&output_dir).await;

    let mut results = Vec::with_capacity(count);
    let mut total_duration = 0.0;

    for (idx, variant) in variants.into_iter().enumerate() {
        let var_index = (idx + 1) as u32;
        let out_file = output_dir.join(format!("variant_{var_index:02}.mp4"));

        let _ = app_handle.emit(
            "export://fission_progress",
            FissionProgressPayload {
                current_index: var_index,
                total_count: count as u32,
                percent: ((idx as f64) / (count as f64) * 100.0).round(),
                message: format!("正在压制第 {var_index}/{count} 份独特指纹裂变视频..."),
            },
        );

        let (dur, size) = render_video_pipeline(
            &params.video_path,
            params.voice_path.as_deref(),
            &params.subtitles,
            params.platform_preset.as_deref(),
            true,
            &variant,
            &out_file,
            None,
        )
        .await?;

        total_duration = dur;
        results.push(FissionVariantResult {
            index: var_index,
            output_path: out_file.to_string_lossy().to_string(),
            size_bytes: size,
            dedup_options: variant,
        });
    }

    let _ = app_handle.emit(
        "export://fission_progress",
        FissionProgressPayload {
            current_index: count as u32,
            total_count: count as u32,
            percent: 100.0,
            message: format!("成功生成全部 {count} 份矩阵裂变视频！"),
        },
    );

    Ok(BatchFissionResult {
        variants: results,
        total_duration_seconds: total_duration,
    })
}
