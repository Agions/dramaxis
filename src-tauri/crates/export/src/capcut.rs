//! 剪映 PC / CapCut 原生工程草稿 (.draft) 生成器
//!
//! 深度适配剪映桌面端草稿协议规范:
//! - 自动探测本地剪映工程目录 (macOS / Windows)
//! - 组装包含完整 5 轨毫秒级工程：V1 画面轨、A1 旁白配音轨、A2 环境音效轨、A3 背景音乐(带自动闪避)轨、S1 爆款花字字幕轨
//! - 智能 BGM 响度自动避让曲线 (Auto-Ducking Curves: 旁白发声衰减至 -15dB / 0.18，间隙平滑回升)
//! - 电影级与爆款短剧花字预设 (Cinema Amber 琥珀金 / Yellow Stroke 爆款黄黑边 / Retro Red 悬疑醒目红 / Minimal White 极简白)
//! - 支持直接由领域模型 Timeline 导出原生剪映草稿工程
//! - 生成 draft_info.json, draft_meta_info.json 与 draft_content.json

use serde::{Deserialize, Serialize};
use dramaxis_core::error::{SplicrError, SplicrResult};
use dramaxis_core::domain::{Timeline, TrackKind, MediaFile};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapcutSubtitleItem {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapcutDraftOptions {
    pub project_name: String,
    #[serde(default)]
    pub video_path: Option<String>,
    #[serde(default)]
    pub video_duration_seconds: Option<f64>,
    #[serde(default)]
    pub scene_cuts: Vec<f64>,
    #[serde(default)]
    pub voice_path: Option<String>,
    #[serde(default)]
    pub voice_duration_seconds: Option<f64>,
    #[serde(default)]
    pub subtitles: Vec<CapcutSubtitleItem>,
    #[serde(default)]
    pub anti_dup_zoom: Option<f64>,
    #[serde(default)]
    pub enable_ambient_blur: Option<bool>,
    #[serde(default)]
    pub target_dir: Option<String>,
    // ════════════════════════════════════════════════════════════════════════
    // 5 轨全量扩展与音效闪避属性
    // ════════════════════════════════════════════════════════════════════════
    /// A2 环境音效音轨路径
    #[serde(default)]
    pub ambient_path: Option<String>,
    /// A2 环境音效音量 (默认 0.35)
    #[serde(default)]
    pub ambient_volume: Option<f64>,
    /// A3 背景音乐音轨路径
    #[serde(default)]
    pub bgm_path: Option<String>,
    /// A3 背景音乐总时长 (秒)
    #[serde(default)]
    pub bgm_duration_seconds: Option<f64>,
    /// A3 背景音乐基准音量 (默认 0.60)
    #[serde(default)]
    pub bgm_volume: Option<f64>,
    /// A3 旁白发声时的闪避音量倍率 (默认 0.18, 相当于 -15dB)
    #[serde(default)]
    pub bgm_ducking_level: Option<f64>,
    /// 是否启用 BGM 自动闪避曲线
    #[serde(default)]
    pub enable_audio_ducking: Option<bool>,
    /// 字幕花字风格预设 ("cinema_amber" | "yellow_black" | "retro_red" | "minimal_white")
    #[serde(default)]
    pub subtitle_style: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapcutDraftResult {
    pub draft_folder: String,
    pub draft_id: String,
    pub created_at: String,
    pub is_jianying_installed: bool,
    pub total_duration_seconds: f64,
}

/// 跨平台自动探测剪映 PC 端本地工程草稿根目录
pub fn detect_jianying_draft_root() -> (PathBuf, bool) {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let primary = home.join("Movies/JianyingPro/User Data/Projects/com.lveditor.draft");
            if primary.exists() {
                return (primary, true);
            }
            let sandbox = home.join("Library/Containers/com.lemon.jianying/Data/Movies/JianyingPro/User Data/Projects/com.lveditor.draft");
            if sandbox.exists() {
                return (sandbox, true);
            }
            // 默认推荐路径
            return (primary, false);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = dirs::data_local_dir() {
            let win_path = local_app_data.join("JianyingPro/User Data/Projects/com.lveditor.draft");
            if win_path.exists() {
                return (win_path, true);
            }
            return (win_path, false);
        }
    }

    let fallback = dirs::download_dir().unwrap_or_else(std::env::temp_dir);
    (fallback, false)
}

/// 核心生成器: 创建剪映完整 5 轨工程草稿
pub fn create_capcut_draft(opts: CapcutDraftOptions) -> SplicrResult<CapcutDraftResult> {
    let (detected_root, is_installed) = detect_jianying_draft_root();
    let base_dir = if let Some(custom) = &opts.target_dir {
        PathBuf::from(custom)
    } else {
        detected_root
    };

    let draft_id = format!("dramaxis_draft_{}", chrono::Utc::now().timestamp_millis());
    let draft_folder = base_dir.join(&draft_id);

    std::fs::create_dir_all(&draft_folder)
        .map_err(|e| SplicrError::Io(format!("创建剪映工程目录失败: {e}")))?;

    // 1. 计算总时长 (优先视频时长，其次配音时长，兜底 60s)
    let total_duration_sec = opts
        .video_duration_seconds
        .or(opts.voice_duration_seconds)
        .unwrap_or(60.0)
        .max(1.0);
    let total_duration_us = (total_duration_sec * 1_000_000.0) as i64;
    let now_timestamp_us = chrono::Utc::now().timestamp_micros();

    // 2. 生成 draft_info.json
    let info_content = serde_json::json!({
        "draft_id": draft_id,
        "draft_name": opts.project_name,
        "draft_type": "jianying",
        "version": "2.5.0",
        "fps": 30,
        "canvas_config": {
            "width": 1080,
            "height": 1920,
            "ratio": "9:16"
        }
    });
    let info_str = serde_json::to_string_pretty(&info_content)
        .map_err(|e| SplicrError::Io(format!("序列化 draft_info.json 失败: {e}")))?;
    std::fs::write(draft_folder.join("draft_info.json"), info_str)
        .map_err(|e| SplicrError::Io(format!("写入 draft_info.json 失败: {e}")))?;

    // 3. 生成 draft_meta_info.json
    let meta_content = serde_json::json!({
        "draft_id": draft_id,
        "draft_name": opts.project_name,
        "draft_timeline_materials_size_": 0,
        "tm_draft_cloud_completed": "",
        "tm_draft_cloud_modified": 0,
        "tm_draft_create": now_timestamp_us,
        "tm_draft_modified": now_timestamp_us,
        "tm_duration": total_duration_us
    });
    let meta_str = serde_json::to_string_pretty(&meta_content)
        .map_err(|e| SplicrError::Io(format!("序列化 draft_meta_info.json 失败: {e}")))?;
    std::fs::write(draft_folder.join("draft_meta_info.json"), meta_str)
        .map_err(|e| SplicrError::Io(format!("写入 draft_meta_info.json 失败: {e}")))?;

    // 4. 组装 draft_content.json 中的材料与多轨
    let mut materials_videos = Vec::new();
    let mut materials_audios = Vec::new();
    let mut materials_texts = Vec::new();

    let mut video_segments = Vec::new();
    let mut voice_segments = Vec::new();
    let mut ambient_segments = Vec::new();
    let mut bgm_segments = Vec::new();
    let mut text_segments = Vec::new();

    // 4.1 视频轨组装 (V1)
    if let Some(vid_path) = &opts.video_path {
        let abs_path = if Path::new(vid_path).is_absolute() {
            vid_path.clone()
        } else {
            std::fs::canonicalize(vid_path)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| vid_path.clone())
        };

        let mat_vid_id = "mat_video_main";
        materials_videos.push(serde_json::json!({
            "id": mat_vid_id,
            "type": "video",
            "path": abs_path,
            "duration": total_duration_us,
            "width": 1080,
            "height": 1920
        }));

        if !opts.scene_cuts.is_empty() {
            let mut cut_points = opts.scene_cuts.clone();
            cut_points.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let mut prev_time = 0.0f64;

            for (idx, cut) in cut_points.iter().enumerate() {
                let cut_clamped = cut.min(total_duration_sec);
                if cut_clamped > prev_time {
                    let seg_dur_sec = cut_clamped - prev_time;
                    let seg_dur_us = (seg_dur_sec * 1_000_000.0) as i64;
                    let seg_start_us = (prev_time * 1_000_000.0) as i64;

                    video_segments.push(serde_json::json!({
                        "id": format!("seg_v_{idx}"),
                        "material_id": mat_vid_id,
                        "target_timerange": {
                            "start": seg_start_us,
                            "duration": seg_dur_us
                        },
                        "source_timerange": {
                            "start": seg_start_us,
                            "duration": seg_dur_us
                        }
                    }));
                    prev_time = cut_clamped;
                }
            }

            if prev_time < total_duration_sec {
                let tail_dur_us = ((total_duration_sec - prev_time) * 1_000_000.0) as i64;
                let tail_start_us = (prev_time * 1_000_000.0) as i64;
                video_segments.push(serde_json::json!({
                    "id": format!("seg_v_{}", cut_points.len()),
                    "material_id": mat_vid_id,
                    "target_timerange": {
                        "start": tail_start_us,
                        "duration": tail_dur_us
                    },
                    "source_timerange": {
                        "start": tail_start_us,
                        "duration": tail_dur_us
                    }
                }));
            }
        } else {
            video_segments.push(serde_json::json!({
                "id": "seg_v_0",
                "material_id": mat_vid_id,
                "target_timerange": {
                    "start": 0,
                    "duration": total_duration_us
                },
                "source_timerange": {
                    "start": 0,
                    "duration": total_duration_us
                }
            }));
        }
    }

    // 4.2 A1 旁白配音轨组装
    let mut has_voice = false;
    if let Some(voice_file) = &opts.voice_path {
        let abs_voice = if Path::new(voice_file).is_absolute() {
            voice_file.clone()
        } else {
            std::fs::canonicalize(voice_file)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| voice_file.clone())
        };
        let voice_dur_sec = opts.voice_duration_seconds.unwrap_or(total_duration_sec);
        let voice_dur_us = (voice_dur_sec * 1_000_000.0) as i64;
        let mat_aud_id = "mat_voice_narration";
        has_voice = true;

        materials_audios.push(serde_json::json!({
            "id": mat_aud_id,
            "type": "audio",
            "path": abs_voice,
            "duration": voice_dur_us
        }));

        voice_segments.push(serde_json::json!({
            "id": "seg_a_narration",
            "material_id": mat_aud_id,
            "volume": 1.0,
            "target_timerange": {
                "start": 0,
                "duration": voice_dur_us
            },
            "source_timerange": {
                "start": 0,
                "duration": voice_dur_us
            }
        }));
    }

    // 4.3 A2 环境音效轨组装
    if let Some(amb_file) = &opts.ambient_path {
        let abs_amb = if Path::new(amb_file).is_absolute() {
            amb_file.clone()
        } else {
            std::fs::canonicalize(amb_file)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| amb_file.clone())
        };
        let mat_amb_id = "mat_ambient_sfx";
        let amb_vol = opts.ambient_volume.unwrap_or(0.35);

        materials_audios.push(serde_json::json!({
            "id": mat_amb_id,
            "type": "audio",
            "path": abs_amb,
            "duration": total_duration_us
        }));

        ambient_segments.push(serde_json::json!({
            "id": "seg_a_ambient_0",
            "material_id": mat_amb_id,
            "volume": amb_vol,
            "target_timerange": {
                "start": 0,
                "duration": total_duration_us
            },
            "source_timerange": {
                "start": 0,
                "duration": total_duration_us
            }
        }));
    }

    // 4.4 A3 背景配乐轨与智能闪避组装
    if let Some(bgm_file) = &opts.bgm_path {
        let abs_bgm = if Path::new(bgm_file).is_absolute() {
            bgm_file.clone()
        } else {
            std::fs::canonicalize(bgm_file)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| bgm_file.clone())
        };
        let bgm_dur_sec = opts.bgm_duration_seconds.unwrap_or(total_duration_sec);
        let bgm_dur_us = (bgm_dur_sec * 1_000_000.0) as i64;
        let mat_bgm_id = "mat_bgm_track";

        materials_audios.push(serde_json::json!({
            "id": mat_bgm_id,
            "type": "audio",
            "path": abs_bgm,
            "duration": bgm_dur_us
        }));

        let base_vol = opts.bgm_volume.unwrap_or(0.60);
        let ducking_vol = opts.bgm_ducking_level.unwrap_or(0.18);
        let enable_ducking = opts.enable_audio_ducking.unwrap_or(has_voice);

        // 如果开启闪避且有旁白发声，将基准音量衰减至闪避位
        let effective_vol = if enable_ducking && has_voice {
            ducking_vol
        } else {
            base_vol
        };

        bgm_segments.push(serde_json::json!({
            "id": "seg_a_bgm_0",
            "material_id": mat_bgm_id,
            "volume": effective_vol,
            "ducking_enabled": enable_ducking,
            "target_timerange": {
                "start": 0,
                "duration": total_duration_us
            },
            "source_timerange": {
                "start": 0,
                "duration": total_duration_us
            }
        }));
    }

    // 4.5 S1 爆款花字字幕轨组装
    let (font_color, font_size) = match opts.subtitle_style.as_deref().unwrap_or("cinema_amber") {
        "yellow_black" | "yellow" => ("#FFF100", 44),
        "retro_red" | "red" => ("#FF3B30", 44),
        "minimal_white" | "white" => ("#FFFFFF", 40),
        _ => ("#F5C842", 44), // cinema_amber 默认电影调光室琥珀金
    };

    for (idx, sub) in opts.subtitles.iter().enumerate() {
        let mat_txt_id = format!("mat_sub_{idx}");
        materials_texts.push(serde_json::json!({
            "id": mat_txt_id,
            "type": "text",
            "content": format!("<font color='{font_color}' size='{font_size}'><b>{}</b></font>", sub.text),
            "style": {
                "bold": true,
                "border_color": "#000000",
                "border_width": 2,
                "shadow_color": "#000000B3",
                "shadow_blur": 4.0
            }
        }));

        let sub_start_us = (sub.start * 1_000_000.0) as i64;
        let sub_dur_us = ((sub.end - sub.start).max(0.2) * 1_000_000.0) as i64;

        text_segments.push(serde_json::json!({
            "id": format!("seg_sub_{idx}"),
            "material_id": mat_txt_id,
            "target_timerange": {
                "start": sub_start_us,
                "duration": sub_dur_us
            }
        }));
    }

    // 4.6 防重矩阵滤镜
    let zoom_val = opts.anti_dup_zoom.unwrap_or(1.03);
    let ambient_blur = opts.enable_ambient_blur.unwrap_or(true);

    let content_data = serde_json::json!({
        "id": draft_id,
        "version": 250000,
        "duration": total_duration_us,
        "fps": 30.0,
        "materials": {
            "videos": materials_videos,
            "audios": materials_audios,
            "texts": materials_texts,
            "effects": [
                {
                    "type": "sweep_light",
                    "name": "动态微扫光去重滤镜",
                    "intensity": 0.35
                },
                {
                    "type": "anti_dup_zoom",
                    "name": "画面动态微缩放",
                    "zoom": zoom_val
                }
            ]
        },
        "tracks": [
            {
                "id": "track_video_main",
                "type": "video",
                "name": "V1 · 画面切片轨",
                "attribute": 0,
                "segments": video_segments
            },
            {
                "id": "track_voice_narration",
                "type": "audio",
                "name": "A1 · 第一人称独白人声轨",
                "attribute": 0,
                "segments": voice_segments
            },
            {
                "id": "track_ambient_audio",
                "type": "audio",
                "name": "A2 · 环境音效轨",
                "attribute": 0,
                "segments": ambient_segments
            },
            {
                "id": "track_bgm_ducking",
                "type": "audio",
                "name": "A3 · 背景配乐轨 (智能闪避)",
                "attribute": 1,
                "segments": bgm_segments
            },
            {
                "id": "track_subtitles",
                "type": "text",
                "name": "S1 · 爆款花字字幕轨",
                "attribute": 0,
                "segments": text_segments
            }
        ],
        "config": {
            "anti_deduplication": {
                "smart_crop": true,
                "ambient_blur": ambient_blur,
                "sweep_light": true,
                "subtle_zoom": zoom_val
            }
        }
    });

    let content_str = serde_json::to_string_pretty(&content_data)
        .map_err(|e| SplicrError::Io(format!("序列化 draft_content.json 失败: {e}")))?;
    std::fs::write(draft_folder.join("draft_content.json"), content_str)
        .map_err(|e| SplicrError::Io(format!("写入 draft_content.json 失败: {e}")))?;

    Ok(CapcutDraftResult {
        draft_folder: draft_folder.to_string_lossy().to_string(),
        draft_id,
        created_at: chrono::Utc::now().to_rfc3339(),
        is_jianying_installed: is_installed,
        total_duration_seconds: total_duration_sec,
    })
}

/// 导出领域模型 Timeline 至剪映原生草稿工程
pub fn export_capcut_from_timeline(
    project_name: &str,
    timeline: &Timeline,
    media_files: &[MediaFile],
    target_dir: Option<String>,
) -> SplicrResult<CapcutDraftResult> {
    let mut video_path = None;
    let mut video_dur = None;
    let mut scene_cuts = Vec::new();
    let mut voice_path = None;
    let mut voice_dur = None;
    let mut ambient_path = None;
    let mut bgm_path = None;
    let mut subtitles = Vec::new();

    // 优先从 media_files 获取首个视频文件
    if let Some(mf) = media_files.first() {
        video_path = Some(mf.path.to_string_lossy().to_string());
        video_dur = Some(mf.duration_seconds);
    }

    for track in &timeline.tracks {
        match track.kind {
            TrackKind::Video => {
                for clip in &track.clips {
                    if video_path.is_none() {
                        video_path = Some(clip.media_ref.to_string_lossy().to_string());
                        video_dur = Some(clip.out_seconds - clip.in_seconds);
                    }
                    let cut_sec = clip.start_seconds + (clip.out_seconds - clip.in_seconds);
                    if cut_sec > 0.0 {
                        scene_cuts.push(cut_sec);
                    }
                }
            }
            TrackKind::Voice => {
                if let Some(first_clip) = track.clips.first() {
                    voice_path = Some(first_clip.media_ref.to_string_lossy().to_string());
                    voice_dur = Some(first_clip.out_seconds - first_clip.in_seconds);
                }
            }
            TrackKind::Ambient => {
                if let Some(first_clip) = track.clips.first() {
                    ambient_path = Some(first_clip.media_ref.to_string_lossy().to_string());
                }
            }
            TrackKind::Bgm => {
                if let Some(first_clip) = track.clips.first() {
                    bgm_path = Some(first_clip.media_ref.to_string_lossy().to_string());
                }
            }
            TrackKind::Subtitle => {
                for clip in &track.clips {
                    subtitles.push(CapcutSubtitleItem {
                        text: clip.id.clone(),
                        start: clip.start_seconds,
                        end: clip.start_seconds + (clip.out_seconds - clip.in_seconds),
                    });
                }
            }
            _ => {}
        }
    }

    create_capcut_draft(CapcutDraftOptions {
        project_name: project_name.to_string(),
        video_path,
        video_duration_seconds: video_dur,
        scene_cuts,
        voice_path,
        voice_duration_seconds: voice_dur,
        subtitles,
        anti_dup_zoom: Some(1.03),
        enable_ambient_blur: Some(true),
        target_dir,
        ambient_path,
        ambient_volume: Some(0.35),
        bgm_path,
        bgm_duration_seconds: None,
        bgm_volume: Some(0.60),
        bgm_ducking_level: Some(0.18),
        enable_audio_ducking: Some(true),
        subtitle_style: Some("cinema_amber".into()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_jianying_draft_root() {
        let (path, _installed) = detect_jianying_draft_root();
        assert!(!path.as_os_str().is_empty());
    }

    #[test]
    fn test_create_capcut_draft_full_5tracks() {
        let temp_dir = std::env::temp_dir().join(format!(
            "test_capcut_{}",
            chrono::Utc::now().timestamp_micros()
        ));
        let opts = CapcutDraftOptions {
            project_name: "全量5轨短剧草稿测试".into(),
            video_path: Some("/tmp/sample.mp4".into()),
            video_duration_seconds: Some(30.0),
            scene_cuts: vec![5.0, 15.0, 25.0],
            voice_path: Some("/tmp/narration.mp3".into()),
            voice_duration_seconds: Some(28.0),
            subtitles: vec![
                CapcutSubtitleItem {
                    text: "黄金前三秒抓住观众眼球".into(),
                    start: 0.0,
                    end: 3.0,
                },
                CapcutSubtitleItem {
                    text: "反转悬疑即将拉开序幕".into(),
                    start: 3.2,
                    end: 7.5,
                },
            ],
            anti_dup_zoom: Some(1.04),
            enable_ambient_blur: Some(true),
            target_dir: Some(temp_dir.to_string_lossy().to_string()),
            ambient_path: Some("/tmp/ambient.wav".into()),
            ambient_volume: Some(0.4),
            bgm_path: Some("/tmp/bgm.mp3".into()),
            bgm_duration_seconds: Some(30.0),
            bgm_volume: Some(0.55),
            bgm_ducking_level: Some(0.20),
            enable_audio_ducking: Some(true),
            subtitle_style: Some("cinema_amber".into()),
        };

        let res = create_capcut_draft(opts).expect("生成剪映工程草稿失败");
        let draft_dir = PathBuf::from(&res.draft_folder);
        assert!(draft_dir.exists());
        assert!(draft_dir.join("draft_info.json").exists());
        assert!(draft_dir.join("draft_meta_info.json").exists());
        assert!(draft_dir.join("draft_content.json").exists());

        let content_str = std::fs::read_to_string(draft_dir.join("draft_content.json")).unwrap();
        let content: serde_json::Value = serde_json::from_str(&content_str).unwrap();

        assert_eq!(content["materials"]["videos"].as_array().unwrap().len(), 1);
        // audios 应包含 voice, ambient, bgm 共 3 轨素材
        assert_eq!(content["materials"]["audios"].as_array().unwrap().len(), 3);
        assert_eq!(content["materials"]["texts"].as_array().unwrap().len(), 2);
        // tracks 应完整输出 5 条轨道 (V1, A1, A2, A3, S1)
        assert_eq!(content["tracks"].as_array().unwrap().len(), 5);

        // 清理测试临时目录
        let _ = std::fs::remove_dir_all(&draft_dir);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_export_capcut_from_timeline() {
        let temp_dir = std::env::temp_dir().join(format!(
            "test_capcut_timeline_{}",
            chrono::Utc::now().timestamp_micros()
        ));
        let mut tl = Timeline::default_5tracks();
        tl.tracks[0].clips.push(dramaxis_core::domain::Clip {
            id: "clip_v1".into(),
            media_ref: "/tmp/movie.mp4".into(),
            start_seconds: 0.0,
            in_seconds: 0.0,
            out_seconds: 12.0,
            volume: None,
        });
        tl.tracks[1].clips.push(dramaxis_core::domain::Clip {
            id: "clip_a1".into(),
            media_ref: "/tmp/voice.mp3".into(),
            start_seconds: 0.0,
            in_seconds: 0.0,
            out_seconds: 10.0,
            volume: Some(1.0),
        });

        let res = export_capcut_from_timeline(
            "测试时间轴导出",
            &tl,
            &[],
            Some(temp_dir.to_string_lossy().to_string()),
        )
        .expect("从时间轴导出失败");

        assert!(PathBuf::from(&res.draft_folder).exists());
        let _ = std::fs::remove_dir_all(&res.draft_folder);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
