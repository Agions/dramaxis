//! src-tauri 命令 · settings 持久化 (M3.2)
//!
//! ConfigSnapshot 落盘到 `app_data_dir/config.json`。
//! 第一次启动若无文件 → 返回默认 snapshot。

use std::path::PathBuf;

use dramaxis_core::error::SplicrError;
use dramaxis_core::services::{ConfigService, ConfigSnapshot};
use dramaxis_core::AppContext;
use tauri::{Manager, State};

const CONFIG_FILE: &str = "config.json";

/// 读取配置 (优先磁盘,缺则返回默认)
#[tauri::command]
pub async fn settings_get(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
) -> Result<ConfigSnapshot, SplicrError> {
    let path = config_path(&app).map_err(|e| SplicrError::Config(e.to_string()))?;
    if let Ok(bytes) = tokio::fs::read(&path).await {
        if let Ok(snap) = serde_json::from_slice::<ConfigSnapshot>(&bytes) {
            // 同步到内存 service
            let svc = state
                .service::<ConfigService>()
                .await
                .map_err(|e| SplicrError::Config(e.to_string()))?;
            svc.set_snapshot(snap.clone()).await;
            return Ok(snap);
        }
    }
    // fallback: 默认 snapshot
    Ok(ConfigSnapshot::default())
}

/// 保存配置 (同时落盘 + 更新内存)
#[tauri::command]
pub async fn settings_set(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
    snapshot: ConfigSnapshot,
) -> Result<(), SplicrError> {
    let path = config_path(&app).map_err(|e| SplicrError::Config(e.to_string()))?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| SplicrError::Io(e.to_string()))?;
    }
    let bytes =
        serde_json::to_vec_pretty(&snapshot).map_err(|e| SplicrError::Config(e.to_string()))?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;

    let svc = state
        .service::<ConfigService>()
        .await
        .map_err(|e| SplicrError::Config(e.to_string()))?;
    svc.set_snapshot(snapshot).await;
    Ok(())
}

/// LLM 连通性测试返回载荷
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmTestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub message: String,
    pub model: String,
}

/// 测试指定大模型提供商的 API 连通性与网络往返延迟
#[tauri::command]
pub async fn settings_test_llm(
    provider: String,
    api_key: String,
    model: Option<String>,
    base_url: Option<String>,
) -> Result<LlmTestResult, SplicrError> {
    use dramaxis_core::error::LlmProviderKind;

    let kind = match provider.to_lowercase().as_str() {
        "deepseek" => LlmProviderKind::DeepSeek,
        "openai" | "open-ai" => LlmProviderKind::OpenAi,
        "qwen" => LlmProviderKind::Qwen,
        "kimi" => LlmProviderKind::Kimi,
        "glm" | "glm5" => LlmProviderKind::Glm5,
        "doubao" => LlmProviderKind::Doubao,
        "hunyuan" => LlmProviderKind::Hunyuan,
        "claude" => LlmProviderKind::Claude,
        "gemini" => LlmProviderKind::Gemini,
        "local" => LlmProviderKind::Local,
        "custom" => LlmProviderKind::OpenAi,
        _ => LlmProviderKind::DeepSeek,
    };

    let start = std::time::Instant::now();
    let p = dramaxis_script::factory_custom(kind, api_key, base_url);
    let req = dramaxis_script::LlmRequest {
        system: "You are a connectivity test agent. Reply with 'OK'.".to_string(),
        user: "ping".to_string(),
        model,
        max_tokens: Some(10),
        temperature: Some(0.1),
        stream: false,
        images_base64: Vec::new(),
    };

    match p.chat(&req).await {
        Ok(resp) => Ok(LlmTestResult {
            success: true,
            latency_ms: start.elapsed().as_millis() as u64,
            message: if resp.content.trim().is_empty() {
                "服务响应正常 (200 OK)".to_string()
            } else {
                format!("验证成功: {}", resp.content.trim())
            },
            model: resp.model,
        }),
        Err(e) => Ok(LlmTestResult {
            success: false,
            latency_ms: start.elapsed().as_millis() as u64,
            message: format!("连通失败: {e}"),
            model: "unknown".to_string(),
        }),
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("无法获取 app data 目录: {e}")))?;
    Ok(dir.join(CONFIG_FILE))
}
