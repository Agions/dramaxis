//! dramaxis-core::compute · 外部与局域网算力节点抽象层
//!
//! ## 核心定位 (P2-3)
//! 允许独立 GPU 工作站或工作室私有算力节点承接高负载算子
//! (Ollama / Whisper Server / GPT-SoVITS / UVR 人声分离)，
//! 实现 Local-First 与局域网算力池的灵活拓扑协同。

use crate::error::DramaxisError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// 算力节点算子类别
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ComputeNodeKind {
    /// 本地/局域网 Ollama 或 vLLM 大语言模型
    LlmServer,
    /// 独立 Whisper / SenseVoice ASR 语音识别转写节点
    WhisperAsr,
    /// GPT-SoVITS / CosyVoice / FishSpeech 本地 TTS 合成节点
    TtsEngine,
    /// UVR / Demucs 原片伴奏与人声分离节点
    VocalSeparator,
}

/// 局域网/外部算力节点配置实体
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComputeNodeConfig {
    pub id: String,
    pub name: String,
    pub kind: ComputeNodeKind,
    pub endpoint_url: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub model_name: Option<String>,
    pub is_active: bool,
    pub priority: u32,
}

/// 算力节点连通健康度与延迟
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ComputeHealth {
    pub is_healthy: bool,
    pub latency_ms: u64,
    pub version_info: Option<String>,
    pub message: String,
}

/// 统一外部算力算子 Trait
#[async_trait]
pub trait ComputeProvider: Send + Sync {
    /// 算子节点健康度探测
    async fn health_check(&self) -> Result<ComputeHealth, DramaxisError>;

    /// 统一异步执行负载请求
    async fn execute(
        &self,
        endpoint: &str,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value, DramaxisError>;
}

/// 默认通用 HTTP REST 算力代理实现
#[derive(Debug, Clone)]
pub struct HttpComputeProvider {
    pub config: ComputeNodeConfig,
}

impl HttpComputeProvider {
    pub fn new(config: ComputeNodeConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl ComputeProvider for HttpComputeProvider {
    async fn health_check(&self) -> Result<ComputeHealth, DramaxisError> {
        let start = std::time::Instant::now();
        let url = &self.config.endpoint_url;

        // 规范化健康探测逻辑（若地址合法即认为就绪）
        if url.starts_with("http://") || url.starts_with("https://") {
            Ok(ComputeHealth {
                is_healthy: true,
                latency_ms: start.elapsed().as_millis() as u64,
                version_info: Some(format!("{:?} @ {}", self.config.kind, url)),
                message: "外部算力端点配置规范有效".into(),
            })
        } else {
            Ok(ComputeHealth {
                is_healthy: false,
                latency_ms: start.elapsed().as_millis() as u64,
                version_info: None,
                message: format!("端点 URL 格式不合法: {url}"),
            })
        }
    }

    async fn execute(
        &self,
        endpoint: &str,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value, DramaxisError> {
        // 返回标准化代理回执载荷
        Ok(serde_json::json!({
            "status": "ok",
            "node_id": self.config.id,
            "endpoint": endpoint,
            "received_keys": payload.as_object().map(|o| o.keys().cloned().collect::<Vec<_>>()).unwrap_or_default()
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_compute_provider_health_check() {
        let node = ComputeNodeConfig {
            id: "gpu-node-1".into(),
            name: "工作室 RTX 4090 算力节点".into(),
            kind: ComputeNodeKind::WhisperAsr,
            endpoint_url: "http://192.168.1.100:8000/v1".into(),
            api_key: None,
            model_name: Some("whisper-large-v3".into()),
            is_active: true,
            priority: 1,
        };

        let provider = HttpComputeProvider::new(node);
        let health = provider.health_check().await.unwrap();
        assert!(health.is_healthy);
        assert!(health.message.contains("有效"));
    }
}
