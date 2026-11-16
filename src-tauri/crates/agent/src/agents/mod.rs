//! 异构多智能体实现集合 (Agents Module)
//!
//! 包含 6 大专精智能体角色的行为与决策逻辑:
//! - `DirectorAgent`: 总控统筹导演 (lead.rs)
//! - `VisualCriticAgent`: 画面视觉分析师 (vision.rs)
//! - `ScreenwriterAgent`: 金牌编剧 (writer.rs)
//! - `VoiceArtistAgent`: 声乐调音师 (voice.rs)
//! - `SoundEngineerAgent`: 混音剪辑师 (audio.rs)
//! - `QualityReviewerAgent`: 终审质量守门员 (audit.rs)

pub mod audit;
pub mod audio;
pub mod lead;
pub mod vision;
pub mod voice;
pub mod writer;

pub use audit::QualityReviewerAgent;
pub use audio::SoundEngineerAgent;
pub use lead::DirectorAgent;
pub use vision::VisualCriticAgent;
pub use voice::VoiceArtistAgent;
pub use writer::ScreenwriterAgent;

use crate::context::AgentContext;
use crate::types::AgentRole;
use async_trait::async_trait;
use dramaxis_core::error::{DramaxisResult, LlmProviderKind};
use dramaxis_core::services::AgentModelMatrix;

/// 异构模型路由解析器：支持按角色专精覆盖，未配置时优雅继承全局默认参数
pub fn resolve_agent_llm(
    ctx: &AgentContext,
    role: AgentRole,
) -> (LlmProviderKind, String, Option<String>, Option<String>, f32) {
    let role_override = if let Some(matrix_json) = ctx.memory.get("agent_model_matrix_json") {
        if let Ok(matrix) = serde_json::from_str::<AgentModelMatrix>(matrix_json) {
            match role {
                AgentRole::Director => matrix.director,
                AgentRole::VisualCritic => matrix.visual_critic,
                AgentRole::Screenwriter => matrix.screenwriter,
                AgentRole::QualityReviewer => matrix.quality_reviewer,
                _ => None,
            }
        } else {
            None
        }
    } else {
        None
    };

    let default_provider_str = ctx
        .memory
        .get("llm_provider")
        .cloned()
        .unwrap_or_else(|| "qwen".into());
    let default_api_key = ctx.memory.get("llm_api_key").cloned().unwrap_or_default();
    let default_base_url = ctx.memory.get("llm_base_url").cloned();
    let default_model = ctx.memory.get("llm_model").cloned();

    let (prov_str, api_key, base_url, model, temp) = if let Some(ov) = role_override {
        (
            ov.provider.unwrap_or(default_provider_str),
            ov.api_key.unwrap_or(default_api_key),
            ov.base_url.or(default_base_url),
            ov.model.or(default_model),
            ov.temperature.unwrap_or(0.75),
        )
    } else {
        (
            default_provider_str,
            default_api_key,
            default_base_url,
            default_model,
            0.75,
        )
    };

    let kind = match prov_str.to_lowercase().as_str() {
        "deepseek" => LlmProviderKind::DeepSeek,
        "openai" | "open-ai" => LlmProviderKind::OpenAi,
        "claude" => LlmProviderKind::Claude,
        "gemini" => LlmProviderKind::Gemini,
        "kimi" => LlmProviderKind::Kimi,
        "glm" | "glm5" => LlmProviderKind::Glm5,
        "doubao" => LlmProviderKind::Doubao,
        "hunyuan" => LlmProviderKind::Hunyuan,
        "local" => LlmProviderKind::Local,
        "qwen" => LlmProviderKind::Qwen,
        _ => LlmProviderKind::OpenAi,
    };

    (kind, api_key, model, base_url, temp)
}

#[async_trait]
pub trait Agent: Send + Sync {
    fn role(&self) -> AgentRole;
    fn name(&self) -> &str;
    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>>;
}
