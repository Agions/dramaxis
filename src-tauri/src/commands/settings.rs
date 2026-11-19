//! src-tauri 命令 · settings 持久化 (M3.2)
//!
//! ConfigSnapshot 落盘到 `app_data_dir/config.json`。
//! 第一次启动若无文件 → 返回默认 snapshot。

use std::path::PathBuf;

use dramaxis_core::error::DramaxisError;
use dramaxis_core::services::{ConfigService, ConfigSnapshot};
use dramaxis_core::AppContext;
use dramaxis_storage::CredentialVault;
use tauri::{Manager, State};

const CONFIG_FILE: &str = "config.json";

/// 读取配置 (优先磁盘并在安全金库中解密还原敏感凭证)
#[tauri::command]
pub async fn settings_get(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
) -> Result<ConfigSnapshot, DramaxisError> {
    let path = config_path(&app).map_err(|e| DramaxisError::Config(e.to_string()))?;
    let mut snap = if let Ok(bytes) = tokio::fs::read(&path).await {
        serde_json::from_slice::<ConfigSnapshot>(&bytes).unwrap_or_default()
    } else {
        ConfigSnapshot::default()
    };

    // 从安全凭证金库中还原敏感 API Key
    if let Ok(vp) = vault_path(&app) {
        let vault = CredentialVault::load(&vp).await;
        if let Some(key) = vault.get("llm_api_key") {
            snap.llm_api_key = Some(key.clone());
        }
        if let Some(key) = vault.get("tts_api_key") {
            snap.tts_api_key = Some(key.clone());
        }
        if let Some(ref mut matrix) = snap.agent_model_matrix {
            if let Some(ref mut vc) = matrix.visual_critic {
                if let Some(k) = vault.get("matrix_visual_critic_key") {
                    vc.api_key = Some(k.clone());
                }
            }
            if let Some(ref mut sw) = matrix.screenwriter {
                if let Some(k) = vault.get("matrix_screenwriter_key") {
                    sw.api_key = Some(k.clone());
                }
            }
            if let Some(ref mut qr) = matrix.quality_reviewer {
                if let Some(k) = vault.get("matrix_quality_reviewer_key") {
                    qr.api_key = Some(k.clone());
                }
            }
            if let Some(ref mut dir) = matrix.director {
                if let Some(k) = vault.get("matrix_director_key") {
                    dir.api_key = Some(k.clone());
                }
            }
        }
    }

    // 同步到内存 service
    if let Ok(svc) = state.service::<ConfigService>().await {
        svc.set_snapshot(snap.clone()).await;
    }

    Ok(snap)
}

/// 保存配置 (敏感凭证写入受限权限金库 + config.json 遮罩脱敏)
#[tauri::command]
pub async fn settings_set(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
    snapshot: ConfigSnapshot,
) -> Result<(), DramaxisError> {
    let path = config_path(&app).map_err(|e| DramaxisError::Config(e.to_string()))?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| DramaxisError::Io(e.to_string()))?;
    }

    let mut real_snapshot = snapshot.clone();

    // 1. 凭证隔离持久化至受保护金库 (credentials.vault)
    if let Ok(vp) = vault_path(&app) {
        let mut vault = CredentialVault::load(&vp).await;

        let sync_vault_key =
            |v: &mut CredentialVault, key_name: &str, field: &mut Option<String>| match field
                .as_deref()
            {
                Some("********") => {
                    *field = v.get(key_name).cloned();
                }
                Some(val) if !val.trim().is_empty() => {
                    v.set(key_name, val.trim());
                    *field = Some(val.trim().to_string());
                }
                _ => {
                    v.remove(key_name);
                    *field = None;
                }
            };

        sync_vault_key(&mut vault, "llm_api_key", &mut real_snapshot.llm_api_key);
        sync_vault_key(&mut vault, "tts_api_key", &mut real_snapshot.tts_api_key);

        if let Some(ref mut matrix) = real_snapshot.agent_model_matrix {
            if let Some(ref mut vc) = matrix.visual_critic {
                sync_vault_key(&mut vault, "matrix_visual_critic_key", &mut vc.api_key);
            }
            if let Some(ref mut sw) = matrix.screenwriter {
                sync_vault_key(&mut vault, "matrix_screenwriter_key", &mut sw.api_key);
            }
            if let Some(ref mut qr) = matrix.quality_reviewer {
                sync_vault_key(&mut vault, "matrix_quality_reviewer_key", &mut qr.api_key);
            }
            if let Some(ref mut dir) = matrix.director {
                sync_vault_key(&mut vault, "matrix_director_key", &mut dir.api_key);
            }
        }

        let _ = vault.save(&vp).await;
    }

    // 2. config.json 落盘时遮罩脱敏，杜绝明文密钥暴露
    let mut sanitized = real_snapshot.clone();
    if sanitized.llm_api_key.is_some() {
        sanitized.llm_api_key = Some("********".into());
    }
    if sanitized.tts_api_key.is_some() {
        sanitized.tts_api_key = Some("********".into());
    }
    if let Some(ref mut matrix) = sanitized.agent_model_matrix {
        if let Some(ref mut vc) = matrix.visual_critic {
            if vc.api_key.is_some() {
                vc.api_key = Some("********".into());
            }
        }
        if let Some(ref mut sw) = matrix.screenwriter {
            if sw.api_key.is_some() {
                sw.api_key = Some("********".into());
            }
        }
        if let Some(ref mut qr) = matrix.quality_reviewer {
            if qr.api_key.is_some() {
                qr.api_key = Some("********".into());
            }
        }
        if let Some(ref mut dir) = matrix.director {
            if dir.api_key.is_some() {
                dir.api_key = Some("********".into());
            }
        }
    }

    let bytes =
        serde_json::to_vec_pretty(&sanitized).map_err(|e| DramaxisError::Config(e.to_string()))?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| DramaxisError::Io(e.to_string()))?;

    // 3. 内存中保留真实可用凭证
    let svc = state
        .service::<ConfigService>()
        .await
        .map_err(|e| DramaxisError::Config(e.to_string()))?;
    svc.set_snapshot(real_snapshot).await;
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
) -> Result<LlmTestResult, DramaxisError> {
    use dramaxis_core::error::LlmProviderKind;

    let kind: LlmProviderKind = provider.parse().unwrap_or(LlmProviderKind::DeepSeek);

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

fn vault_path(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("无法获取 app data 目录: {e}")))?;
    Ok(CredentialVault::default_vault_path(&dir))
}
