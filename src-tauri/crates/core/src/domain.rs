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

/// 脚本段落类型（P1-2: 支持解说旁白、原片原声金句穿插与气口停顿混排）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SegmentKind {
    /// AI 第一人称解说旁白（默认）
    #[default]
    Narration,
    /// 原片高光原声金句留白（保留原片人声，暂停旁白并压低 BGM）
    OriginalClip,
    /// 叙事气口/悬念停顿
    Pause,
}

/// 第一人称叙述脚本的一段 (含黄金前3秒爆款钩子、原声金句穿插与画面对齐评定)。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScriptSegment {
    pub id: String,
    pub step_index: u8, // 0..=6 (对应 7 步流水线)
    pub text: String,   // 中文人称或原片金句台词
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
    #[serde(default)]
    pub kind: SegmentKind,
    /// 原片素材入点（秒），当 `kind == SegmentKind::OriginalClip` 时生效
    #[serde(default)]
    pub source_in_sec: Option<f64>,
    /// 原片素材出点（秒），当 `kind == SegmentKind::OriginalClip` 时生效
    #[serde(default)]
    pub source_out_sec: Option<f64>,
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
            kind: SegmentKind::Narration,
            source_in_sec: None,
            source_out_sec: None,
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// P1-1: 剧集三层内容模型 (Series -> Episode -> Variant) 与 Story Bible
// ════════════════════════════════════════════════════════════════════════

/// 剧集人物档案（确保 60~100 集微短剧连载解说中称呼、身份与关系零串戏）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CharacterProfile {
    pub id: String,
    pub name: String,
    /// 解说常用昵称/标签（如“隐藏大佬男主”、“势利眼岳母”）
    pub alias: Option<String>,
    pub role_type: String,
    pub traits: String,
    pub relationships: String,
}

/// 剧集剧情圣经与跨集滚动记忆库 (Story Bible)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoryBible {
    pub series_id: String,
    pub worldview: String,
    pub core_conflict: String,
    pub narrator_persona: String,
    pub characters: Vec<CharacterProfile>,
    /// 按集数累积的滚动前情提要（每集定稿自动沉淀 150~200 字）
    pub rolling_recaps: Vec<EpisodeRecap>,
}

/// 单集前情提要节点
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EpisodeRecap {
    pub episode_number: u32,
    pub summary: String,
    pub unresolved_hook: Option<String>,
}

impl StoryBible {
    /// 格式化为注入编剧 Agent Prompt 的跨集剧情记忆上下文
    pub fn to_prompt_context(&self) -> String {
        let mut buf = String::new();
        if !self.worldview.trim().is_empty() {
            buf.push_str(&format!("【世界观与主线冲突】{} / {}\n", self.worldview, self.core_conflict));
        }
        if !self.characters.is_empty() {
            buf.push_str("【核心人物档案（严禁改名或混淆关系）】\n");
            for c in &self.characters {
                let alias = c
                    .alias
                    .as_deref()
                    .map(|a| format!("（解说称呼: {a}）"))
                    .unwrap_or_default();
                buf.push_str(&format!(
                    "- {}{} [{}]: {} | 关系: {}\n",
                    c.name, alias, c.role_type, c.traits, c.relationships
                ));
            }
        }
        if !self.rolling_recaps.is_empty() {
            buf.push_str("【前情提要（最近 3 集滚动记忆）】\n");
            let start = self.rolling_recaps.len().saturating_sub(3);
            for r in &self.rolling_recaps[start..] {
                let hook = r
                    .unresolved_hook
                    .as_deref()
                    .map(|h| format!(" | 遗留悬念: {h}"))
                    .unwrap_or_default();
                buf.push_str(&format!("- 第 {} 集: {}{}\n", r.episode_number, r.summary, hook));
            }
        }
        buf
    }
}

/// 顶层剧集空间 (Series)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    pub id: String,
    pub title: String,
    pub genre: String,
    pub default_style: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 分集拆条单元 (Episode)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Episode {
    pub id: String,
    pub series_id: String,
    pub episode_number: u32,
    pub title: String,
    pub source_paths: Vec<PathBuf>,
    pub created_at: DateTime<Utc>,
}

/// 同一分集下的矩阵变体工程 (Variant)，共享原片语义索引，独立维护风格/平台/脚本
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    pub id: String,
    pub episode_id: String,
    pub project_id: String,
    pub label: String,
    pub style_preset: String,
    pub target_platform: Option<PlatformId>,
    pub created_at: DateTime<Utc>,
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

/// 批量任务执行状态 (P2-1)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BatchJobStatus {
    #[default]
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for BatchJobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Running => write!(f, "running"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// 批量任务业务算子类型 (P2-1)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BatchJobType {
    AsrTranscribe,
    SceneAnalysis,
    ScriptGeneration,
    VoiceSynthesis,
    MasterRender,
    FullFission,
}

/// 持久化后台批处理任务实体 (P2-1)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchJob {
    pub id: String,
    pub job_type: BatchJobType,
    pub status: BatchJobStatus,
    pub payload_json: String,
    pub result_json: Option<String>,
    pub error_message: Option<String>,
    pub progress: f32,
    pub retry_count: u32,
    pub max_retries: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
