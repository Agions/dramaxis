//! Final Cut Pro XML (FCPXML 1.10) 专业时间线导出器
//!
//! 深度兼容 Final Cut Pro, DaVinci Resolve, Adobe Premiere Pro (XML 导入):
//! - 映射 Dramaxis 5 轨时间线 (V1 画面、A1 旁白、A2 音效、A3 BGM、S1 轴幕)
//! - 自动生成 resources/format/asset 资产描述表
//! - 规范化处理基于分数秒的 FCPXML 1.10 时间码 (e.g. 100/3000s)

use crate::ExportError;
use dramaxis_core::domain::{Clip, MediaFile, Timeline, TrackKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// FCPXML 导出配置选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FcpxmlOptions {
    pub project_name: String,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
}

fn default_fps() -> u32 {
    30
}
fn default_width() -> u32 {
    1080
}
fn default_height() -> u32 {
    1920
}

impl Default for FcpxmlOptions {
    fn default() -> Self {
        Self {
            project_name: "Dramaxis Project".to_string(),
            fps: 30,
            width: 1080,
            height: 1920,
        }
    }
}

/// 格式化秒数为 FCPXML 规范的分数秒字符串 (e.g. "100/3000s")
pub fn format_rational_time(seconds: f64, fps: u32) -> String {
    let den = (fps * 100) as i64;
    let num = (seconds * den as f64).round() as i64;
    format!("{}/{}s", num, den)
}

/// XML 转义工具函数
fn xml_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// 根据时间线与媒体列表生成 FCPXML 1.10 格式的 XML 字符串
pub fn export_fcpxml_string(
    timeline: &Timeline,
    media_files: &[MediaFile],
    options: &FcpxmlOptions,
) -> Result<String, ExportError> {
    let fps = if options.fps == 0 { 30 } else { options.fps };
    let frame_duration = format!("100/{}s", fps * 100);

    // 建立媒体文件绝对路径 -> 资产 ID 的映射
    let mut media_asset_map = HashMap::new();
    let mut assets_xml = String::new();

    for (idx, media) in media_files.iter().enumerate() {
        let asset_id = format!("r{}", idx + 2); // r1 为 format
        let path_str = media.path.to_string_lossy();
        let file_name = media
            .path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("media_{}", idx));

        let duration_str = format_rational_time(media.duration_seconds, fps);
        let src_url = if path_str.starts_with("file://") {
            xml_escape(&path_str)
        } else {
            xml_escape(&format!("file://{}", path_str))
        };

        // 判定媒体类型属性
        let has_video = if media.resolution.is_some()
            || path_str.ends_with(".mp4")
            || path_str.ends_with(".mov")
            || path_str.ends_with(".mkv")
        {
            "1"
        } else {
            "0"
        };
        let has_audio = "1";

        assets_xml.push_str(&format!(
            "        <asset id=\"{}\" name=\"{}\" src=\"{}\" start=\"0s\" duration=\"{}\" hasVideo=\"{}\" hasAudio=\"{}\" format=\"r1\" />\n",
            asset_id,
            xml_escape(&file_name),
            src_url,
            duration_str,
            has_video,
            has_audio
        ));

        media_asset_map.insert(media.path.clone(), asset_id);
    }

    // 分拣各轨道的 Clips
    let mut video_clips: Vec<&Clip> = Vec::new();
    let mut voice_clips: Vec<&Clip> = Vec::new();
    let mut ambient_clips: Vec<&Clip> = Vec::new();
    let mut bgm_clips: Vec<&Clip> = Vec::new();
    let mut subtitle_clips: Vec<&Clip> = Vec::new();

    for track in &timeline.tracks {
        match track.kind {
            TrackKind::Video => video_clips.extend(track.clips.iter()),
            TrackKind::Voice => voice_clips.extend(track.clips.iter()),
            TrackKind::Ambient => ambient_clips.extend(track.clips.iter()),
            TrackKind::Bgm => bgm_clips.extend(track.clips.iter()),
            TrackKind::Subtitle => subtitle_clips.extend(track.clips.iter()),
            TrackKind::Audio => voice_clips.extend(track.clips.iter()),
        }
    }

    // 计算总时长
    let mut max_timeline_duration = 0.0f64;
    for clip in video_clips
        .iter()
        .chain(voice_clips.iter())
        .chain(ambient_clips.iter())
        .chain(bgm_clips.iter())
        .chain(subtitle_clips.iter())
    {
        let end = clip.start_seconds + (clip.out_seconds - clip.in_seconds).max(0.0);
        if end > max_timeline_duration {
            max_timeline_duration = end;
        }
    }
    if max_timeline_duration <= 0.0 {
        max_timeline_duration = 10.0; // 兜底保护
    }

    let total_duration_str = format_rational_time(max_timeline_duration, fps);

    // 构建 spine 主干序列
    let mut spine_xml = String::new();

    if video_clips.is_empty() {
        // 如果没有视频片段，使用主干 gap 作为承载锚点
        spine_xml.push_str(&format!(
            "                    <gap offset=\"0s\" duration=\"{}\" start=\"0s\">\n",
            total_duration_str
        ));

        // 挂载旁白 (A1: lane="-1")
        append_audio_clips_xml(
            &mut spine_xml,
            &voice_clips,
            &media_asset_map,
            "-1",
            "Voice",
            fps,
        );
        // 挂载音效 (A2: lane="-2")
        append_audio_clips_xml(
            &mut spine_xml,
            &ambient_clips,
            &media_asset_map,
            "-2",
            "Ambient",
            fps,
        );
        // 挂载 BGM (A3: lane="-3")
        append_audio_clips_xml(
            &mut spine_xml,
            &bgm_clips,
            &media_asset_map,
            "-3",
            "BGM",
            fps,
        );
        // 挂载字幕 (S1: lane="1")
        append_subtitle_clips_xml(&mut spine_xml, &subtitle_clips, fps);

        spine_xml.push_str("                    </gap>\n");
    } else {
        // 存在视频片段，按时间线主干铺设
        for (idx, vclip) in video_clips.iter().enumerate() {
            let asset_ref = media_asset_map
                .get(&vclip.media_ref)
                .cloned()
                .unwrap_or_else(|| "r_missing".to_string());
            let clip_duration = (vclip.out_seconds - vclip.in_seconds).max(0.01);
            let offset_str = format_rational_time(vclip.start_seconds, fps);
            let duration_str = format_rational_time(clip_duration, fps);
            let in_str = format_rational_time(vclip.in_seconds, fps);

            spine_xml.push_str(&format!(
                "                    <asset-clip ref=\"{}\" offset=\"{}\" duration=\"{}\" start=\"{}\" name=\"Video Clip {}\">\n",
                asset_ref, offset_str, duration_str, in_str, idx + 1
            ));

            // 首个视频片段作为所有并行音轨与字幕的锚点容器
            if idx == 0 {
                append_audio_clips_xml(
                    &mut spine_xml,
                    &voice_clips,
                    &media_asset_map,
                    "-1",
                    "Voice",
                    fps,
                );
                append_audio_clips_xml(
                    &mut spine_xml,
                    &ambient_clips,
                    &media_asset_map,
                    "-2",
                    "Ambient",
                    fps,
                );
                append_audio_clips_xml(
                    &mut spine_xml,
                    &bgm_clips,
                    &media_asset_map,
                    "-3",
                    "BGM",
                    fps,
                );
                append_subtitle_clips_xml(&mut spine_xml, &subtitle_clips, fps);
            }

            spine_xml.push_str("                    </asset-clip>\n");
        }
    }

    let doc = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat{}p{}" frameDuration="{}" width="{}" height="{}" />
        <effect id="r_title" name="Basic Title" uid=".../Titles.localized/Bumper:Grommet.localized/Basic Title.localized/Basic Title.moti" />
{}    </resources>
    <library>
        <event name="Dramaxis Studio Event">
            <project name="{}">
                <sequence format="r1" duration="{}" tcStart="0s" tcFormat="NDF">
                    <spine>
{}                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
"#,
        options.height,
        fps,
        frame_duration,
        options.width,
        options.height,
        assets_xml,
        xml_escape(&options.project_name),
        total_duration_str,
        spine_xml
    );

    Ok(doc)
}

fn append_audio_clips_xml(
    xml: &mut String,
    clips: &[&Clip],
    media_asset_map: &HashMap<PathBuf, String>,
    lane: &str,
    role: &str,
    fps: u32,
) {
    for (idx, clip) in clips.iter().enumerate() {
        let asset_ref = media_asset_map
            .get(&clip.media_ref)
            .cloned()
            .unwrap_or_else(|| "r_audio".to_string());
        let duration = (clip.out_seconds - clip.in_seconds).max(0.01);
        let offset_str = format_rational_time(clip.start_seconds, fps);
        let duration_str = format_rational_time(duration, fps);
        let in_str = format_rational_time(clip.in_seconds, fps);
        let volume_db = clip
            .volume
            .map(|v| format!("{:.1}dB", 20.0 * v.max(0.001).log10()))
            .unwrap_or_else(|| "0.0dB".to_string());

        xml.push_str(&format!(
            "                        <asset-clip lane=\"{}\" ref=\"{}\" offset=\"{}\" duration=\"{}\" start=\"{}\" name=\"{} Clip {}\" role=\"{}\">\n",
            lane, asset_ref, offset_str, duration_str, in_str, role, idx + 1, role.to_lowercase()
        ));
        xml.push_str(&format!(
            "                            <adjust-volume amount=\"{}\" />\n",
            volume_db
        ));
        xml.push_str("                        </asset-clip>\n");
    }
}

fn append_subtitle_clips_xml(xml: &mut String, clips: &[&Clip], fps: u32) {
    for (idx, clip) in clips.iter().enumerate() {
        let duration = (clip.out_seconds - clip.in_seconds).max(0.01);
        let offset_str = format_rational_time(clip.start_seconds, fps);
        let duration_str = format_rational_time(duration, fps);
        let title_text = clip
            .media_ref
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("Subtitle {}", idx + 1));

        xml.push_str(&format!(
            "                        <title lane=\"1\" ref=\"r_title\" offset=\"{}\" duration=\"{}\" start=\"0s\" name=\"{}\">\n",
            offset_str, duration_str, xml_escape(&title_text)
        ));
        xml.push_str(&format!(
            "                            <text><text-style ref=\"ts1\">{}</text-style></text>\n",
            xml_escape(&title_text)
        ));
        xml.push_str("                        </title>\n");
    }
}

/// 导出 FCPXML 文件到目标文件路径
pub fn export_fcpxml_file(
    timeline: &Timeline,
    media_files: &[MediaFile],
    options: &FcpxmlOptions,
    output_path: &Path,
) -> Result<PathBuf, ExportError> {
    let xml_content = export_fcpxml_string(timeline, media_files, options)?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, xml_content)?;
    Ok(output_path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use dramaxis_core::domain::TrackKind;

    #[test]
    fn test_format_rational_time() {
        assert_eq!(format_rational_time(0.0, 30), "0/3000s");
        assert_eq!(format_rational_time(1.0, 30), "3000/3000s");
        assert_eq!(format_rational_time(2.5, 30), "7500/3000s");
    }

    #[test]
    fn test_export_fcpxml_5tracks_generation() {
        let mut timeline = Timeline::default_5tracks();

        let video_path = PathBuf::from("/Volumes/Share/video1.mp4");
        let voice_path = PathBuf::from("/Volumes/Share/voice1.wav");

        let media_files = vec![
            MediaFile {
                path: video_path.clone(),
                duration_seconds: 60.0,
                resolution: Some("1080x1920".into()),
                codec: Some("h264".into()),
                file_size_bytes: 10_000_000,
                import_time: Utc::now(),
            },
            MediaFile {
                path: voice_path.clone(),
                duration_seconds: 30.0,
                resolution: None,
                codec: Some("pcm_s16le".into()),
                file_size_bytes: 2_000_000,
                import_time: Utc::now(),
            },
        ];

        // 添加视频 clip
        for track in &mut timeline.tracks {
            if track.kind == TrackKind::Video {
                track.clips.push(Clip {
                    id: "v1".into(),
                    media_ref: video_path.clone(),
                    start_seconds: 0.0,
                    in_seconds: 5.0,
                    out_seconds: 15.0,
                    volume: None,
                });
            }
            if track.kind == TrackKind::Voice {
                track.clips.push(Clip {
                    id: "a1".into(),
                    media_ref: voice_path.clone(),
                    start_seconds: 0.5,
                    in_seconds: 0.0,
                    out_seconds: 8.0,
                    volume: Some(1.0),
                });
            }
        }

        let options = FcpxmlOptions {
            project_name: "短剧解说第一集".into(),
            fps: 30,
            width: 1080,
            height: 1920,
        };

        let xml = export_fcpxml_string(&timeline, &media_files, &options).unwrap();
        assert!(xml.contains("<fcpxml version=\"1.10\">"));
        assert!(xml.contains("短剧解说第一集"));
        assert!(xml.contains("file:///Volumes/Share/video1.mp4"));
        assert!(xml.contains("file:///Volumes/Share/voice1.wav"));
        assert!(xml.contains("lane=\"-1\""));
        assert!(xml.contains("name=\"Voice Clip 1\""));
    }
}
