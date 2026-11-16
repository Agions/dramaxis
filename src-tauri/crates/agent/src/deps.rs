//! 运行时后端私有依赖 (AgentRuntimeDeps)
//!
//! 包含敏感凭据与重量级底层服务句柄 (LLM, TTS, FFmpeg, Config)
//! 严格只驻留在 Rust 进程内存中，绝不随 AgentContext 序列化至前端 IPC。

use crate::types::AgentRole;
use dramaxis_core::services::{AgentModelMatrix, ConfigSnapshot};
use dramaxis_script::LlmProviderKind;

/// 智能体私有运行时依赖容器
#[derive(Debug, Clone, Default)]
pub struct AgentRuntimeDeps {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub matrix: Option<AgentModelMatrix>,
}

impl AgentRuntimeDeps {
    /// 从系统配置快照构造
    pub fn from_config(snap: &ConfigSnapshot) -> Self {
        Self {
            api_key: snap.llm_api_key.clone(),
            base_url: snap.llm_base_url.clone(),
            model: snap.llm_model.clone(),
            provider: Some(snap.llm_provider.clone()),
            matrix: snap.agent_model_matrix.clone(),
        }
    }

    /// 解析指定智能体角色的专精大模型参数 (带 Matrix 动态重载支持)
    pub fn resolve_agent_llm(
        &self,
        role: AgentRole,
    ) -> (LlmProviderKind, String, Option<String>, Option<String>, f32) {
        let role_override = self.matrix.as_ref().and_then(|m| match role {
            AgentRole::Director => m.director.clone(),
            AgentRole::VisualCritic => m.visual_critic.clone(),
            AgentRole::Screenwriter => m.screenwriter.clone(),
            AgentRole::QualityReviewer => m.quality_reviewer.clone(),
            _ => None,
        });

        let default_provider_str = self
            .provider
            .clone()
            .unwrap_or_else(|| "qwen".into());
        let default_api_key = self.api_key.clone().unwrap_or_default();
        let default_base_url = self.base_url.clone();
        let default_model = self.model.clone();

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

        let kind = match prov_str.as_str() {
            "openai" | "open-ai" => LlmProviderKind::OpenAi,
            "claude" => LlmProviderKind::Claude,
            "gemini" => LlmProviderKind::Gemini,
            "kimi" => LlmProviderKind::Kimi,
            "glm5" => LlmProviderKind::Glm5,
            "deepseek" => LlmProviderKind::DeepSeek,
            "doubao" => LlmProviderKind::Doubao,
            "hunyuan" => LlmProviderKind::Hunyuan,
            "local" => LlmProviderKind::Local,
            "qwen37" => LlmProviderKind::Qwen37,
            "custom" => LlmProviderKind::OpenAi,
            _ => LlmProviderKind::Qwen,
        };

        (kind, api_key, base_url, model, temp)
    }
}
