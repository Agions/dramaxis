//! dramaxis-agent::blackboard · 强类型版本化多智能体黑板总线 (Typed Versioned Blackboard)
//!
//! 提供跨智能体数据传递、剧本版本链追溯 (v1, v2, v3...) 与多模态视听产物存储

use crate::types::AgentRole;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptArtifact {
    pub version: u32,
    pub author_agent: AgentRole,
    pub prompt_used: String,
    pub text: String,
    pub hook_type: String,
    pub hook_text: String,
    pub estimated_retention: f32,
    pub critique_feedback: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualBriefArtifact {
    pub total_duration_sec: f64,
    pub scene_cuts_sec: Vec<f64>,
    pub keyframe_paths: Vec<String>,
    pub visual_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechInterval {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioBriefArtifact {
    pub has_original_speech: bool,
    pub speech_intervals: Vec<SpeechInterval>,
    pub bgm_intensity_peaks: Vec<f64>,
    pub dialogue_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceArtifact {
    pub audio_path: String,
    pub duration_seconds: f64,
    pub sample_rate: u32,
    pub voice_id: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineArtifact {
    pub total_duration: f64,
    pub tracks_count: usize,
    pub subtitle_count: usize,
    pub b_roll_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityReportArtifact {
    pub hook_score: f32,
    pub sync_tolerance_ms: f32,
    pub pacing_score: f32,
    pub compliance_passed: bool,
    pub overall_score: f32,
    pub suggestions: Vec<String>,
}

/// 强类型版本化黑板总线
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Blackboard {
    pub session_id: String,
    pub created_at: u64,
    /// 视觉分析产物
    pub visual_brief: Option<VisualBriefArtifact>,
    /// 原片音频与对白特征产物
    pub audio_brief: Option<AudioBriefArtifact>,
    /// 剧本版本链 (支持自反思迭代与版本对比)
    pub script_versions: Vec<ScriptArtifact>,
    /// 当前生效的剧本版本索引
    pub active_script_index: usize,
    /// 48kHz 配音产物
    pub voice_artifact: Option<VoiceArtifact>,
    /// 多轨工程时间线资产产物
    pub timeline_artifact: Option<TimelineArtifact>,
    /// 质量与留存张力终审报告
    pub quality_report: Option<QualityReportArtifact>,
}

impl Blackboard {
    pub fn new(session_id: String) -> Self {
        Self {
            session_id,
            created_at: chrono::Utc::now().timestamp_millis() as u64,
            visual_brief: None,
            audio_brief: None,
            script_versions: Vec::new(),
            active_script_index: 0,
            voice_artifact: None,
            timeline_artifact: None,
            quality_report: None,
        }
    }

    /// 追加新版本剧本并激活
    #[allow(clippy::too_many_arguments)]
    pub fn push_script_version(
        &mut self,
        author_agent: AgentRole,
        prompt_used: impl Into<String>,
        text: impl Into<String>,
        hook_type: impl Into<String>,
        hook_text: impl Into<String>,
        estimated_retention: f32,
        critique_feedback: Option<String>,
    ) -> u32 {
        let next_version = (self.script_versions.len() + 1) as u32;
        let artifact = ScriptArtifact {
            version: next_version,
            author_agent,
            prompt_used: prompt_used.into(),
            text: text.into(),
            hook_type: hook_type.into(),
            hook_text: hook_text.into(),
            estimated_retention,
            critique_feedback,
            created_at: chrono::Utc::now().timestamp_millis() as u64,
        };
        self.script_versions.push(artifact);
        self.active_script_index = self.script_versions.len() - 1;
        next_version
    }

    /// 获取当前生效的剧本文案
    pub fn active_script(&self) -> Option<&ScriptArtifact> {
        self.script_versions.get(self.active_script_index)
    }

    /// 回滚生效剧本到指定版本号
    pub fn rollback_script_to_version(&mut self, target_version: u32) -> bool {
        if let Some(pos) = self
            .script_versions
            .iter()
            .position(|s| s.version == target_version)
        {
            self.active_script_index = pos;
            true
        } else {
            false
        }
    }

    pub fn set_visual_brief(&mut self, brief: VisualBriefArtifact) {
        self.visual_brief = Some(brief);
    }

    pub fn set_audio_brief(&mut self, brief: AudioBriefArtifact) {
        self.audio_brief = Some(brief);
    }

    pub fn set_voice_artifact(&mut self, voice: VoiceArtifact) {
        self.voice_artifact = Some(voice);
    }

    pub fn set_timeline_artifact(&mut self, timeline: TimelineArtifact) {
        self.timeline_artifact = Some(timeline);
    }

    pub fn set_quality_report(&mut self, report: QualityReportArtifact) {
        self.quality_report = Some(report);
    }
}
