//! dramaxis-export::renderer
//!
//! 工业级音视频渲染中枢与矩阵裂变引擎。
//! 负责：
//! 1. 动态 GPU 硬件加速编解码器解析 (VideoToolbox / NVENC / QSV / VAAPI / libx264 兜底)
//! 2. 8 维消重矩阵与高斯模糊背景滤镜图谱 (Filter Complex) 自动化组装
//! 3. 毫秒级字幕烧录、多音轨混流与侧链动态闪避 (Audio Ducking)
//! 4. 并发与批量矩阵裂变视频生成

use std::path::Path;

use chrono::Utc;
use dramaxis_core::error::{SplicrError, SplicrResult};
use dramaxis_detect::{Ffmpeg, HardwareAccelerationKind};
use serde::{Deserialize, Serialize};

use crate::capcut::CapcutSubtitleItem;
use crate::dedup::{generate_fission_variants, DedupOptions};

/// 视频渲染入参
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// 视频渲染产物元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderVideoResult {
    pub output_path: String,
    pub duration_seconds: f64,
    pub size_bytes: u64,
}

/// 渲染进度上报载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgressPayload {
    pub percent: f64,
    pub time_seconds: f64,
    pub phase: String,
}

/// 批量裂变入参
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// 单个裂变变体生成结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FissionVariantResult {
    pub index: u32,
    pub output_path: String,
    pub size_bytes: u64,
    pub dedup_options: DedupOptions,
}

/// 批量裂变总输出
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFissionResult {
    pub variants: Vec<FissionVariantResult>,
    pub total_duration_seconds: f64,
}

/// 批量裂变进度广播载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FissionProgressPayload {
    pub current_index: u32,
    pub total_count: u32,
    pub percent: f64,
    pub message: String,
}

/// 格式化毫秒为标准 SRT 时间戳 (HH:MM:SS,mmm)
pub fn format_srt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1000;
    let rem_ms = ms % 1000;
    format!("{h:02}:{m:02}:{s:02},{rem_ms:03}")
}

/// 硬件加速编码配置结构体
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HardwareEncoderConfig {
    pub codec: String,
    pub args: Vec<String>,
}

/// 探测当前设备最佳硬件编码配置 (支持 Apple VideoToolbox / NVENC / QSV / VAAPI，软编回退 libx264)
pub async fn resolve_hardware_encoder(ffmpeg: &Ffmpeg) -> HardwareEncoderConfig {
    let accels = ffmpeg.probe_hardware_acceleration().await;
    for kind in accels {
        match kind {
            HardwareAccelerationKind::VideoToolbox => {
                tracing::info!("🚀 启用 macOS VideoToolbox 硬件加速编码 (h264_videotoolbox)");
                return HardwareEncoderConfig {
                    codec: "h264_videotoolbox".into(),
                    args: vec![
                        "-b:v".into(),
                        "8M".into(),
                        "-profile:v".into(),
                        "high".into(),
                        "-pix_fmt".into(),
                        "yuv420p".into(),
                    ],
                };
            }
            HardwareAccelerationKind::Nvenc => {
                tracing::info!("🚀 启用 NVIDIA NVENC 硬件加速编码 (h264_nvenc)");
                return HardwareEncoderConfig {
                    codec: "h264_nvenc".into(),
                    args: vec![
                        "-preset".into(),
                        "p4".into(),
                        "-cq".into(),
                        "21".into(),
                        "-pix_fmt".into(),
                        "yuv420p".into(),
                    ],
                };
            }
            HardwareAccelerationKind::Qsv => {
                tracing::info!("🚀 启用 Intel QuickSync 硬件加速编码 (h264_qsv)");
                return HardwareEncoderConfig {
                    codec: "h264_qsv".into(),
                    args: vec![
                        "-global_quality".into(),
                        "21".into(),
                        "-pix_fmt".into(),
                        "nv12".into(),
                    ],
                };
            }
            HardwareAccelerationKind::Vaapi => {
                tracing::info!("🚀 启用 Linux VAAPI 硬件加速编码 (h264_vaapi)");
                return HardwareEncoderConfig {
                    codec: "h264_vaapi".into(),
                    args: vec!["-b:v".into(), "8M".into()],
                };
            }
            _ => {}
        }
    }

    tracing::info!("ℹ️ 未检测到支持的硬件编码器，使用 CPU libx264 软编模式");
    HardwareEncoderConfig {
        codec: "libx264".into(),
        args: vec![
            "-preset".into(),
            "veryfast".into(),
            "-crf".into(),
            "21".into(),
            "-pix_fmt".into(),
            "yuv420p".into(),
        ],
    }
}

/// 核心视频压制流水线
#[allow(clippy::too_many_arguments)]
pub async fn render_video_pipeline(
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
) -> SplicrResult<(f64, u64)> {
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
            Utc::now().timestamp_micros()
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
        Utc::now().timestamp_micros() as u64,
    );
    args.extend(meta_args);

    // 5. 动态选择硬件编码器 (GPU 加速优先)
    let hw_config = resolve_hardware_encoder(&ffmpeg).await;
    args.extend(["-c:v".into(), hw_config.codec.clone()]);
    args.extend(hw_config.args);
    args.extend([
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

/// 执行多变体防重裂变批处理核心
pub async fn execute_batch_fission<F>(
    params: BatchFissionParams,
    output_dir: &Path,
    on_step_progress: F,
) -> SplicrResult<BatchFissionResult>
where
    F: Fn(u32, u32, f64, String),
{
    let count = params.count.clamp(1, 20) as usize;
    let base_dedup = params.base_dedup.unwrap_or_default();
    let variants = generate_fission_variants(&base_dedup, count);

    let _ = tokio::fs::create_dir_all(output_dir).await;

    let mut results = Vec::with_capacity(count);
    let mut total_duration = 0.0;

    for (idx, variant) in variants.into_iter().enumerate() {
        let var_index = (idx + 1) as u32;
        let out_file = output_dir.join(format!("variant_{var_index:02}.mp4"));

        on_step_progress(
            var_index,
            count as u32,
            ((idx as f64) / (count as f64) * 100.0).round(),
            format!("正在压制第 {var_index}/{count} 份独特指纹裂变视频..."),
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

    on_step_progress(
        count as u32,
        count as u32,
        100.0,
        format!("成功生成全部 {count} 份矩阵裂变视频！"),
    );

    Ok(BatchFissionResult {
        variants: results,
        total_duration_seconds: total_duration,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_srt_time() {
        assert_eq!(format_srt_time(0), "00:00:00,000");
        assert_eq!(format_srt_time(1250), "00:00:01,250");
        assert_eq!(format_srt_time(3_661_045), "01:01:01,045");
    }

    #[tokio::test]
    async fn test_resolve_hardware_encoder_fallback() {
        let ffmpeg = Ffmpeg::with_bins(PathBuf::from("fake_ffmpeg"), PathBuf::from("fake_ffprobe"));
        let cfg = resolve_hardware_encoder(&ffmpeg).await;
        // 在不存在的 binary 下应平滑兜底为 libx264
        assert_eq!(cfg.codec, "libx264");
        assert!(cfg.args.contains(&"-crf".to_string()));
    }
}
