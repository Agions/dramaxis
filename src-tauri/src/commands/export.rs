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
pub use dramaxis_export::dedup::{generate_fission_variants, DedupIntensity, DedupOptions};
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
    #[serde(default)]
    pub scene_cuts: Option<Vec<f64>>,
    #[serde(default)]
    pub bgm_path: Option<String>,
    #[serde(default)]
    pub bgm_volume: Option<f64>,
    #[serde(default)]
    pub enable_audio_ducking: Option<bool>,
    #[serde(default)]
    pub subtitle_style: Option<String>,
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
    #[serde(default)]
    pub scene_cuts: Option<Vec<f64>>,
    #[serde(default)]
    pub bgm_path: Option<String>,
    #[serde(default)]
    pub bgm_volume: Option<f64>,
    #[serde(default)]
    pub enable_audio_ducking: Option<bool>,
    #[serde(default)]
    pub subtitle_style: Option<String>,
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

/// 内部通用渲染流水线 (支持分镜切片重构、8 维消重矩阵、多花字字幕样式、BGM 侧链闪避)
#[allow(clippy::too_many_arguments)]
async fn render_video_pipeline(
    video_path: &str,
    voice_path: Option<&str>,
    subtitles: &[CapcutSubtitleItem],
    platform_preset: Option<&str>,
    enable_ambient_blur: bool,
    dedup: &DedupOptions,
    scene_cuts: Option<&[f64]>,
    bgm_path: Option<&str>,
    bgm_volume: Option<f64>,
    enable_audio_ducking: bool,
    subtitle_style: Option<&str>,
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

    let (tw, th): (u32, u32) = if is_landscape {
        (1920, 1080)
    } else {
        (1080, 1920)
    };

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

    // 3.1 分镜切片重排 (Scene cuts trim & concat)
    let v_source_tag = if let Some(cuts) = scene_cuts {
        if !cuts.is_empty() {
            let mut sorted_cuts: Vec<f64> = cuts.to_vec();
            sorted_cuts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let mut prev_cut = 0.0f64;
            let mut seg_tags = Vec::new();

            for (idx, cut) in sorted_cuts.iter().enumerate() {
                let end = cut.min(total_duration);
                if end > prev_cut {
                    let seg_tag = format!("vseg_{idx}");
                    filter_complex.push_str(&format!(
                        "[0:v]trim=start={prev_cut:.3}:end={end:.3},setpts=PTS-STARTPTS[{seg_tag}];"
                    ));
                    seg_tags.push(format!("[{seg_tag}]"));
                    prev_cut = end;
                }
            }
            if prev_cut < total_duration {
                let seg_tag = format!("vseg_{}", sorted_cuts.len());
                filter_complex.push_str(&format!(
                    "[0:v]trim=start={prev_cut:.3}:end={total_duration:.3},setpts=PTS-STARTPTS[{seg_tag}];"
                ));
                seg_tags.push(format!("[{seg_tag}]"));
            }

            if seg_tags.len() > 1 {
                let count = seg_tags.len();
                let joined = seg_tags.join("");
                filter_complex.push_str(&format!("{joined}concat=n={count}:v=1:a=0[vcut];"));
                "[vcut]"
            } else {
                "[0:v]"
            }
        } else {
            "[0:v]"
        }
    } else {
        "[0:v]"
    };

    // 3.2 画面缩放与高斯模糊底衬
    if is_landscape {
        filter_complex.push_str(&format!(
            "{v_source_tag}scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        ));
    } else if enable_ambient_blur {
        // 9:16 竖屏高斯模糊底衬
        filter_complex.push_str(&format!(
            "{v_source_tag}split=2[vbg][vfg];[vbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[vbgblur];[vfg]scale=1080:1920:force_original_aspect_ratio=decrease[vfgscaled];[vbgblur][vfgscaled]overlay=(W-w)/2:(H-h)/2[vbase];"
        ));
    } else {
        filter_complex.push_str(&format!(
            "{v_source_tag}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[vbase];"
        ));
    }

    // 3.3 8 维消重矩阵视频算子串接 (微缩放、镜像、噪点、抽插帧、微变速)
    let v_filters = dedup.build_video_filters(tw, th);
    let current_v = if !v_filters.is_empty() {
        let chain = v_filters.join(",");
        filter_complex.push_str(&format!("[vbase]{chain}[vdedup];"));
        "[vdedup]"
    } else {
        "[vbase]"
    };

    // 3.4 字幕烧录与花字映射
    let style_str = match subtitle_style.unwrap_or("cinema_amber") {
        "yellow_black" => {
            "FontSize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Bold=1"
        }
        "retro_red" => {
            "FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H001010D0,BorderStyle=1,Outline=3,Shadow=2,Bold=1"
        }
        "minimal_white" => {
            "FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00202020,BorderStyle=1,Outline=1,Shadow=1,Bold=0"
        }
        "cinema_amber" => {
            "FontSize=22,PrimaryColour=&H0030D5F5,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=2,Bold=1"
        }
        _ => {
            "FontSize=22,PrimaryColour=&H0030D5F5,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=2,Bold=1"
        }
    };

    let v_final_tag = if let Some(ref srt) = temp_srt {
        let escaped = srt
            .to_string_lossy()
            .replace('\\', "\\\\")
            .replace(':', "\\:")
            .replace('\'', "\\'");
        filter_complex.push_str(&format!(
            "{current_v}subtitles='{escaped}':force_style='{style_str}'[vsub];"
        ));
        "[vsub]"
    } else {
        current_v
    };

    // 4. 输入流注册与参数构建
    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), video_path.to_string()];
    let mut next_idx = 1;

    let voice_input_idx = if let Some(v_path) = voice_path {
        if Path::new(v_path).exists() {
            args.push("-i".into());
            args.push(v_path.to_string());
            let idx = next_idx;
            next_idx += 1;
            Some(idx)
        } else {
            None
        }
    } else {
        None
    };

    let bgm_input_idx = if let Some(b_path) = bgm_path {
        if Path::new(b_path).exists() {
            args.push("-i".into());
            args.push(b_path.to_string());
            let idx = next_idx;
            Some(idx)
        } else {
            None
        }
    } else {
        None
    };

    // 3.5 音频混流与 8 维消重音频算子 (带 BGM 侧链动态闪避)
    let a_filters = dedup.build_audio_filters();
    let audio_chain_prefix = if !a_filters.is_empty() {
        format!(",{}", a_filters.join(","))
    } else {
        String::new()
    };
    let bgm_vol = bgm_volume.unwrap_or(0.60);

    let a_final_tag = match (voice_input_idx, bgm_input_idx) {
        (Some(v_idx), Some(b_idx)) => {
            // 旁白 + BGM (带侧链闪避)
            if enable_audio_ducking {
                filter_complex.push_str(&format!(
                    "[{b_idx}:a]volume={bgm_vol}[bgm_norm];[{v_idx}:a]volume=1.0{audio_chain_prefix},asplit=2[sc_voice][main_voice];[bgm_norm][sc_voice]sidechaincompress=threshold=0.08:ratio=6:attack=80:release=350[ducked_bgm];[ducked_bgm][main_voice]amix=inputs=2:duration=first:dropout_transition=2[a_mix];"
                ));
            } else {
                filter_complex.push_str(&format!(
                    "[{b_idx}:a]volume={bgm_vol}[bgm_norm];[{v_idx}:a]volume=1.0{audio_chain_prefix}[main_voice];[bgm_norm][main_voice]amix=inputs=2:duration=first[a_mix];"
                ));
            }
            if probe.audio_codec.is_some() {
                filter_complex.push_str(
                    "[0:a]volume=0.15[a_orig];[a_mix][a_orig]amix=inputs=2:duration=first[aout]",
                );
                "[aout]"
            } else {
                "[a_mix]"
            }
        }
        (Some(v_idx), None) => {
            // 仅旁白
            if probe.audio_codec.is_some() {
                filter_complex.push_str(&format!(
                    "[0:a]volume=0.15[a_orig];[{v_idx}:a]volume=1.0{audio_chain_prefix}[a_voice];[a_orig][a_voice]amix=inputs=2:duration=first[aout]"
                ));
                "[aout]"
            } else {
                filter_complex
                    .push_str(&format!("[{v_idx}:a]volume=1.0{audio_chain_prefix}[aout]"));
                "[aout]"
            }
        }
        (None, Some(b_idx)) => {
            // 仅 BGM
            if probe.audio_codec.is_some() {
                filter_complex.push_str(&format!(
                    "[0:a]volume=0.8[a_orig];[{b_idx}:a]volume={bgm_vol}[bgm_norm];[a_orig][bgm_norm]amix=inputs=2:duration=first[aout]"
                ));
                "[aout]"
            } else {
                filter_complex.push_str(&format!("[{b_idx}:a]volume={bgm_vol}[aout]"));
                "[aout]"
            }
        }
        (None, None) => {
            // 原视频声音
            if probe.audio_codec.is_some() {
                if !a_filters.is_empty() {
                    filter_complex.push_str(&format!("[0:a]{}[aout]", a_filters.join(",")));
                    "[aout]"
                } else {
                    "[0:a]"
                }
            } else {
                ""
            }
        }
    };

    // 4. 拼装 filter_complex 映射并执行
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
    let meta_args = dedup.build_metadata_args(
        "Dramaxis Master",
        chrono::Utc::now().timestamp_micros() as u64,
    );
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

    let encode_res = ffmpeg
        .run_encode(&args_str_refs, Some(&*on_progress_wrapper))
        .await;

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
        params.scene_cuts.as_deref(),
        params.bgm_path.as_deref(),
        params.bgm_volume,
        params.enable_audio_ducking.unwrap_or(true),
        params.subtitle_style.as_deref(),
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
            params.scene_cuts.as_deref(),
            params.bgm_path.as_deref(),
            params.bgm_volume,
            params.enable_audio_ducking.unwrap_or(true),
            params.subtitle_style.as_deref(),
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

/// 在操作系统文件资源管理器中打开指定路径或选中指定文件
#[tauri::command]
pub async fn export_open_folder(path: String) -> Result<(), SplicrError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(SplicrError::Io(format!("目标路径不存在: {path}")));
    }

    #[cfg(target_os = "macos")]
    {
        let _ = tokio::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| SplicrError::Io(format!("调用 open 命令失败: {e}")))?;
    }

    #[cfg(target_os = "windows")]
    {
        let _ = tokio::process::Command::new("explorer")
            .arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| SplicrError::Io(format!("调用 explorer 失败: {e}")))?;
    }

    #[cfg(target_os = "linux")]
    {
        let target = if p.is_dir() {
            p
        } else {
            p.parent().unwrap_or(&p).to_path_buf()
        };
        let _ = tokio::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| SplicrError::Io(format!("调用 xdg-open 失败: {e}")))?;
    }

    Ok(())
}

/// 唤起本机剪映 PC 客户端
#[tauri::command]
pub async fn export_launch_jianying() -> Result<(), SplicrError> {
    #[cfg(target_os = "macos")]
    {
        let status = tokio::process::Command::new("open")
            .args(["-a", "JianyingPro"])
            .status()
            .await;
        if status.is_err() || !status.as_ref().unwrap().success() {
            let alt_status = tokio::process::Command::new("open")
                .args(["-a", "剪映专业版"])
                .status()
                .await;
            if alt_status.is_err() || !alt_status.unwrap().success() {
                return Err(SplicrError::Other(
                    "未能在本机发现已安装的剪映专业版应用程序".into(),
                ));
            }
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let possible_exe = std::path::PathBuf::from(local_app_data)
                .join("JianyingPro")
                .join("Apps")
                .join("JianyingPro.exe");
            if possible_exe.exists() {
                let _ = tokio::process::Command::new(possible_exe)
                    .spawn()
                    .map_err(|e| SplicrError::Io(format!("启动剪映失败: {e}")))?;
                return Ok(());
            }
        }
        Err(SplicrError::Other(
            "未能在本机默认路径发现剪映可执行文件".into(),
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err(SplicrError::Other(
            "Linux 及其他平台暂不支持直接唤起剪映客户端".into(),
        ))
    }
}
