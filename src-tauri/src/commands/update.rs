//! src-tauri 命令 · update
//!
//! - update_get_state: 查询当前状态(给前端轮询 fallback 用)
//! - update_check: 探测 GitHub Releases latest
//! - update_download: 下载到本地(带进度推送)
//! - update_install: 执行更新并平滑重启
//! - update_reset: 重置状态(用户取消)
//!
//! 所有命令通过 `AppContext.services` 解析 `UpdateService` 单例。

use splicr_core::error::SplicrError;
use splicr_core::AppContext;
use splicr_update::{UpdateInfo, UpdateState};
use tauri::{AppHandle, Emitter, State};

/// 查询当前更新状态快照
#[tauri::command]
pub async fn update_get_state(state: State<'_, AppContext>) -> Result<UpdateState, SplicrError> {
    let svc = state
        .service::<splicr_update::UpdateService>()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;
    Ok(svc.snapshot().await)
}

/// 探测 GitHub Releases latest。返回 UpdateInfo(同时写状态)
#[tauri::command]
pub async fn update_check(state: State<'_, AppContext>) -> Result<UpdateInfo, SplicrError> {
    let svc = state
        .service::<splicr_update::UpdateService>()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;
    svc.check()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))
}

/// 下载 latest binary 到本地。返回文件路径。
/// 进度通过 `updater:event` 事件实时推送。
#[tauri::command]
pub async fn update_download(
    app: AppHandle,
    state: State<'_, AppContext>,
) -> Result<String, SplicrError> {
    let svc = state
        .service::<splicr_update::UpdateService>()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;
    let path = svc
        .download(None)
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;

    // 额外 emit 一个 phase=ready 事件(给 listen 兜底)
    let _ = app.emit("updater:event", "ready");

    Ok(path.to_string_lossy().into_owned())
}

/// 执行更新安装并自动重启应用
#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    state: State<'_, AppContext>,
) -> Result<UpdateInstallResult, SplicrError> {
    let svc = state
        .service::<splicr_update::UpdateService>()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;
    let snap = svc.snapshot().await;
    let path = snap
        .downloaded_path
        .ok_or_else(|| SplicrError::Updater("尚未下载更新，请先调用 update_download".into()))?;

    let file_path = std::path::PathBuf::from(&path);
    if !file_path.exists() {
        return Err(SplicrError::Updater("下载的安装包不存在，请重新下载".into()));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = tokio::fs::set_permissions(&file_path, perms).await;
        }
    }

    // 异步延迟 300ms 执行重启，确保当前 IPC 应答能顺利返回给前端
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        app_clone.restart();
    });

    Ok(UpdateInstallResult {
        downloaded_path: path,
        note: "更新已就绪，正在重新启动应用...".into(),
    })
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInstallResult {
    pub downloaded_path: String,
    pub note: String,
}

/// 重置状态(用户取消 / 完成后清场)
#[tauri::command]
pub async fn update_reset(state: State<'_, AppContext>) -> Result<(), SplicrError> {
    let svc = state
        .service::<splicr_update::UpdateService>()
        .await
        .map_err(|e| SplicrError::Updater(e.to_string()))?;
    svc.reset().await;
    Ok(())
}
