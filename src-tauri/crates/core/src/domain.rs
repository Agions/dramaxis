//! dramaxis-core::domain · 核心领域模型实体
//!
//! ## 责任范围
//! 整个应用的"业务对象" — 不依赖任何低层 IO 细节
//!
//! ## 核心领域模型
//! - [`Project`]   : 顶层项目 (1 个 .dramaxis 工程包对应 1 个 Project)
//! - [`MediaFile`] : 媒体文件 (mp4 / mov / wav / mp3)
//! - [`Timeline`]  : 时间线 (含 tracks + clips)
//! - [`Track`]     : 时间线轨道
//! - [`Clip`]      : 时间线片段 (引用 MediaFile 的一部分)
//! - [`ScriptSegment`] : 脚本一段 (第一人称叙述段)
//! - [`ExportRecord`]  : 一次导出记录
//! - [`ExportStrategy`]: 4 策略枚举 (single/concat/batch/series)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 顶层项目。一个 .dramaxis 工程包对应 1 个 Project。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: semver::Version,
    pub settings: ProjectSettings,
    pub media_files: Vec<MediaFile>,
    pub timeline: Timeline,
    pub scripts: Vec<ScriptSegment>,
    pub exports: Vec<ExportRecord>,
}

impl Default for Project {
    fn default() -> Self {
        Self {
            id: uuid_v4_like(),
            name: "未命名项目".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            version: semver::Version::new(1, 0, 1),
            settings: ProjectSettings::default(),
            media_files: vec![],
            timeline: Timeline::default(),
            scripts: vec![],
            exports: vec![],
        }
    }
}

/// 项目的运行时设置 (与全局 ConfigService 不同)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectSettings {
    pub resolution: String, // "1080x1920" 等
    pub fps: u32,           // 30 / 60
    pub bitrate: String,    // "8000k"
    pub container: String,  // "mp4"
    pub codec: String,      // "h264"
    pub four_strategy: ExportStrategy,
    #[serde(default)]
    pub target_platform: Option<PlatformId>,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            resolution: "1080x1920".into(), // 竖屏默认
            fps: 30,
            bitrate: "8000k".into(),
            container: "mp4".into(),
            codec: "h264".into(),
            four_strategy: ExportStrategy::Single,
            target_platform: None,
        }
    }
}

/// 目标发布平台预设 (融合自 Fablr 8 大主流平台消重矩阵)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlatformId {
    Douyin,
    Kuaishou,
    Xiaohongshu,
    Wechat,
    Tiktok,
    Bilibili,
    Youtube,
    #[serde(rename = "youtube-shorts")]
    YoutubeShorts,
}

impl PlatformId {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Douyin => "抖音 (Douyin)",
            Self::Kuaishou => "快手 (Kuaishou)",
            Self::Xiaohongshu => "小红书 (RED)",
            Self::Wechat => "微信视频号 (Channels)",
            Self::Tiktok => "TikTok",
            Self::Bilibili => "哔哩哔哩 (Bilibili)",
            Self::Youtube => "YouTube",
            Self::YoutubeShorts => "YouTube Shorts",
        }
    }

    pub fn default_resolution(&self) -> &'static str {
        match self {
            Self::Bilibili | Self::Youtube => "1920x1080",
            Self::Xiaohongshu => "1080x1440",
            _ => "1080x1920",
        }
    }

    pub fn max_duration_secs(&self) -> Option<u32> {
        match self {
            Self::YoutubeShorts => Some(60),
            Self::Tiktok | Self::Douyin | Self::Kuaishou => Some(600),
            _ => None,
        }
    }
}

/// 媒体文件 (mp4 / mov / wav / mp3)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaFile {
    pub path: PathBuf,
    pub duration_seconds: f64,
    pub resolution: Option<String>, // 仅视频有意义
    pub codec: Option<String>,
    pub file_size_bytes: u64,
    pub import_time: DateTime<Utc>,
}

/// 时间线。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Timeline {
    pub tracks: Vec<Track>,
}

impl Timeline {
    /// 构造标准 5 轨时间线模板 (画面/旁白/环境声/BGM/字幕)
    pub fn default_5tracks() -> Self {
        Self {
            tracks: vec![
                Track {
                    id: "track_video".into(),
                    kind: TrackKind::Video,
                    clips: vec![],
                },
                Track {
                    id: "track_voice".into(),
                    kind: TrackKind::Voice,
                    clips: vec![],
                },
                Track {
                    id: "track_ambient".into(),
                    kind: TrackKind::Ambient,
                    clips: vec![],
                },
                Track {
                    id: "track_bgm".into(),
                    kind: TrackKind::Bgm,
                    clips: vec![],
                },
                Track {
                    id: "track_sub".into(),
                    kind: TrackKind::Subtitle,
                    clips: vec![],
                },
            ],
        }
    }
}

/// 时间线轨道 (5 轨原生支持: 画面 / 旁白 / 环境声 / BGM / 字幕)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Track {
    pub id: String,
    pub kind: TrackKind,
    pub clips: Vec<Clip>,
}

/// 轨道类型 (5 轨时间线 + 兼容通用 Audio)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum TrackKind {
    Video,
    Voice,
    Ambient,
    Bgm,
    Subtitle,
    #[serde(alias = "audio")]
    Audio,
}

/// 时间线片段。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Clip {
    pub id: String,
    pub media_ref: PathBuf,  // 引用的 MediaFile.path
    pub start_seconds: f64,  // 在时间线上的起点
    pub in_seconds: f64,     // 在 MediaFile 中的入点
    pub out_seconds: f64,    // 在 MediaFile 中的出点
    pub volume: Option<f32>, // 仅 audio 有意义
}

/// 第一人称叙述脚本的一段 (含黄金前3秒爆款钩子支持与画面对齐评定)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScriptSegment {
    pub id: String,
    pub step_index: u8, // 0..=6 (对应 7 步流水线)
    pub text: String,   // 中文人称
    pub emotion: Option<String>,
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
    #[serde(default)]
    pub is_hook: Option<bool>,
    #[serde(default)]
    pub hook_style: Option<String>,
    #[serde(default)]
    pub visual_cut_ref: Option<String>,
    #[serde(default)]
    pub score: Option<f32>,
}

impl Default for ScriptSegment {
    fn default() -> Self {
        Self {
            id: format!("seg-{}", uuid_v4_like()),
            step_index: 0,
            text: String::new(),
            emotion: None,
            start_seconds: None,
            end_seconds: None,
            is_hook: None,
            hook_style: None,
            visual_cut_ref: None,
            score: None,
        }
    }
}

/// 一次导出记录。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportRecord {
    pub id: String,
    pub strategy: ExportStrategy,
    pub output_path: PathBuf,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub success: bool,
}

/// 4 种导出策略 (与 v2.4 Python `app/services/export/four_strategy.py` 1:1)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ExportStrategy {
    /// 单条影视做第一人称叙述 (常规)
    Single,
    /// 多素材拼接 (视频拼贴 / 蒙太奇)
    Concat,
    /// 批量并行 (同模板多个 source)
    Batch,
    /// 整季系列 (多集 / 多人物 / 跨多期)
    Series,
}

/// 4 策略的人类可读标签 (zh-CN)
pub fn strategy_label(s: ExportStrategy) -> &'static str {
    match s {
        ExportStrategy::Single => "单条",
        ExportStrategy::Concat => "拼接",
        ExportStrategy::Batch => "批量",
        ExportStrategy::Series => "整季系列",
    }
}

/// 生成全局唯一标识符
fn uuid_v4_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("proj-{:x}", nanos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_default_is_serde_compatible() {
        let p = Project::default();
        let json = serde_json::to_string(&p).unwrap();
        let back: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn four_strategy_serde_roundtrip() {
        for s in [
            ExportStrategy::Single,
            ExportStrategy::Concat,
            ExportStrategy::Batch,
            ExportStrategy::Series,
        ] {
            let j = serde_json::to_string(&s).unwrap();
            let back: ExportStrategy = serde_json::from_str(&j).unwrap();
            assert_eq!(s, back);
        }
    }

    #[test]
    fn strategy_label_covers_all() {
        for s in [
            ExportStrategy::Single,
            ExportStrategy::Concat,
            ExportStrategy::Batch,
            ExportStrategy::Series,
        ] {
            let _ = strategy_label(s);
        }
    }

    #[test]
    fn platform_id_serde_and_props() {
        for p in [
            PlatformId::Douyin,
            PlatformId::Kuaishou,
            PlatformId::Xiaohongshu,
            PlatformId::Wechat,
            PlatformId::Tiktok,
            PlatformId::Bilibili,
            PlatformId::Youtube,
            PlatformId::YoutubeShorts,
        ] {
            let json = serde_json::to_string(&p).unwrap();
            let back: PlatformId = serde_json::from_str(&json).unwrap();
            assert_eq!(p, back);
            assert!(!p.label().is_empty());
            assert!(!p.default_resolution().is_empty());
        }
    }

    #[test]
    fn timeline_5tracks_and_track_kinds() {
        let tl = Timeline::default_5tracks();
        assert_eq!(tl.tracks.len(), 5);
        assert_eq!(tl.tracks[0].kind, TrackKind::Video);
        assert_eq!(tl.tracks[1].kind, TrackKind::Voice);
        assert_eq!(tl.tracks[2].kind, TrackKind::Ambient);
        assert_eq!(tl.tracks[3].kind, TrackKind::Bgm);
        assert_eq!(tl.tracks[4].kind, TrackKind::Subtitle);

        // 验证兼容旧格式 "audio"
        let legacy_audio: TrackKind = serde_json::from_str("\"audio\"").unwrap();
        assert_eq!(legacy_audio, TrackKind::Audio);

        let json = serde_json::to_string(&tl).unwrap();
        let back: Timeline = serde_json::from_str(&json).unwrap();
        assert_eq!(tl, back);
    }
}
