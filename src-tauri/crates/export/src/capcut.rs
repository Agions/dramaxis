//! 剪映 PC / CapCut 原生工程草稿 (.draft) 生成器
//!
//! 深度适配剪映桌面端草稿协议规范:
//! - 自动探测本地剪映工程目录 (macOS / Windows)
//! - 组装包含 V1 视频轨、A1 旁白配音轨、SUB 逐字花字字幕轨与防重滤镜的多轨工程
//! - 生成 draft_info.json, draft_meta_info.json 与 draft_content.json

use serde::{Deserialize, Serialize};
use dramaxis_core::error::{SplicrError, SplicrResult};
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

/// 核心生成器: 创建剪映完整工程草稿
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
    let mut text_segments = Vec::new();

    // 4.1 视频轨组装
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
            // 按切片划分分段
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
            // 单段整条视频
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

        materials_audios.push(serde_json::json!({
            "id": mat_aud_id,
            "type": "audio",
            "path": abs_voice,
            "duration": voice_dur_us
        }));

        voice_segments.push(serde_json::json!({
            "id": "seg_a_narration",
            "material_id": mat_aud_id,
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

    // 4.3 SUB 逐字字幕轨组装
    for (idx, sub) in opts.subtitles.iter().enumerate() {
        let mat_txt_id = format!("mat_sub_{idx}");
        materials_texts.push(serde_json::json!({
            "id": mat_txt_id,
            "type": "text",
            "content": format!("<font color='#FFFFFF' size='42'><b>{}</b></font>", sub.text)
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

    // 4.4 防重矩阵滤镜
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
                "attribute": 0,
                "segments": video_segments
            },
            {
                "id": "track_voice_narration",
                "type": "audio",
                "attribute": 0,
                "segments": voice_segments
            },
            {
                "id": "track_subtitles",
                "type": "text",
                "attribute": 0,
                "segments": text_segments
            },
            {
                "id": "track_bgm_ducking",
                "type": "audio",
                "attribute": 1,
                "segments": []
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_jianying_draft_root() {
        let (path, _installed) = detect_jianying_draft_root();
        assert!(!path.as_os_str().is_empty());
    }

    #[test]
    fn test_create_capcut_draft_full() {
        let temp_dir = std::env::temp_dir().join(format!(
            "test_capcut_{}",
            chrono::Utc::now().timestamp_micros()
        ));
        let opts = CapcutDraftOptions {
            project_name: "单元测试短剧".into(),
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
        assert_eq!(content["materials"]["audios"].as_array().unwrap().len(), 1);
        assert_eq!(content["materials"]["texts"].as_array().unwrap().len(), 2);
        assert_eq!(content["tracks"].as_array().unwrap().len(), 4);

        // 清理测试临时目录
        let _ = std::fs::remove_dir_all(&draft_dir);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
