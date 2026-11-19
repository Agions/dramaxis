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

/// 异构模型路由解析器：支持按角色专精覆盖，未配置时优雅继承全局默认参数
pub fn resolve_agent_llm(
    ctx: &AgentContext,
    role: AgentRole,
) -> (LlmProviderKind, String, Option<String>, Option<String>, f32) {
    let deps = crate::deps::AgentRuntimeDeps {
        api_key: ctx.memory.get("llm_api_key").cloned(),
        base_url: ctx.memory.get("llm_base_url").cloned(),
        model: ctx.memory.get("llm_model").cloned(),
        provider: ctx.memory.get("llm_provider").cloned(),
        matrix: ctx
            .memory
            .get("agent_model_matrix_json")
            .and_then(|j| serde_json::from_str(j).ok()),
    };
    deps.resolve_agent_llm(role)
}

#[async_trait]
pub trait Agent: Send + Sync {
    fn role(&self) -> AgentRole;
    fn name(&self) -> &str;
    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>>;
}
