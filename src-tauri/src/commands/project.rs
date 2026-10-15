//! src-tauri 命令 · project 完整 CRUD (M3.2)
//!
//! Tauri command 层:将 [`ProjectService`] 暴露为前端可调用的 IPC 指令。

use std::path::{Path, PathBuf};

use dramaxis_core::domain::{MediaFile, Project};
use dramaxis_core::error::SplicrError;
use dramaxis_core::services::ProjectService;
use dramaxis_core::AppContext;
use tauri::{Manager, State};

/// 列举最近项目 (M3.2 真实从 ProjectService 取)
#[tauri::command]
pub async fn project_list_recent(state: State<'_, AppContext>) -> Result<Vec<String>, SplicrError> {
    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| SplicrError::Project(e.to_string()))?;
    let paths = svc.recent_projects().await;
    Ok(paths
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect())
}

/// 创建空白 Project 并保存到默认 projects 目录。
/// 返回 (path, project) 元组:前端用 path 记住文件位置。
#[tauri::command]
pub async fn project_create_blank(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
) -> Result<ProjectRecord, SplicrError> {
    let mut proj = Project::default();
    proj.timeline = dramaxis_core::domain::Timeline::default_5tracks();
    let base_dir = project_dir(&app).map_err(|e| SplicrError::Io(e.to_string()))?;
    let proj_dir = base_dir.join(&proj.id);

    // 建立 Local-First 沙盒目录骨架: media/, drafts/, cache/
    tokio::fs::create_dir_all(proj_dir.join("media"))
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;
    tokio::fs::create_dir_all(proj_dir.join("drafts"))
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;
    tokio::fs::create_dir_all(proj_dir.join("cache"))
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;

    let path = proj_dir.join("project.dramaxis.json");
    write_project(&path, &proj)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;

    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| SplicrError::Project(e.to_string()))?;
    svc.push_recent(path.clone()).await;

    Ok(ProjectRecord {
        path: path.to_string_lossy().into_owned(),
        project: proj,
    })
}

/// 从指定路径加载 Project (支持文件或项目目录)
#[tauri::command]
pub async fn project_load(
    path: String,
    state: State<'_, AppContext>,
) -> Result<ProjectRecord, SplicrError> {
    let mut p = PathBuf::from(&path);
    if p.is_dir() {
        let canonical_file = p.join("project.dramaxis.json");
        if canonical_file.exists() {
            p = canonical_file;
        }
    }
    let bytes = tokio::fs::read(&p)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;
    let proj: Project = serde_json::from_slice(&bytes)
        .map_err(|e| SplicrError::Project(format!("解析项目文件失败: {e}")))?;

    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| SplicrError::Project(e.to_string()))?;
    svc.push_recent(p.clone()).await;

    Ok(ProjectRecord {
        path: p.to_string_lossy().into_owned(),
        project: proj,
    })
}

/// 把 Project 落盘到指定路径
#[tauri::command]
pub async fn project_save(path: String, project: Project) -> Result<(), SplicrError> {
    let p = PathBuf::from(&path);
    write_project(&p, &project)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))
}

/// 删除指定路径的 Project 文件，并同步从最近工程列表中注销
#[tauri::command]
pub async fn project_delete(state: State<'_, AppContext>, path: String) -> Result<(), SplicrError> {
    let p = PathBuf::from(&path);
    if p.is_file() {
        let _ = tokio::fs::remove_file(&p).await;
        // 如果是标准的 project.dramaxis.json，清理外层沙盒工程目录
        if p.file_name().and_then(|n| n.to_str()) == Some("project.dramaxis.json") {
            if let Some(parent) = p.parent() {
                let _ = tokio::fs::remove_dir_all(parent).await;
            }
        }
    } else if p.is_dir() {
        let _ = tokio::fs::remove_dir_all(&p).await;
    }
    if let Ok(svc) = state.service::<ProjectService>().await {
        svc.remove_recent(&p).await;
    }
    Ok(())
}

/// 给现有 Project 追加一个素材 (前端素材页拖拽后调用，自动建立 Local-First 媒体软链接)
#[tauri::command]
pub async fn project_add_media(
    path: String,
    project: Project,
    media: MediaFile,
) -> Result<Project, SplicrError> {
    let p = PathBuf::from(&path);
    let mut proj = project;

    // 如果处于 Local-First 沙盒目录内，在 media/ 目录下建立软链接
    if let Some(parent) = p.parent() {
        let media_dir = parent.join("media");
        if media_dir.is_dir() {
            if let Some(file_name) = media.path.file_name() {
                let link_dest = media_dir.join(file_name);
                #[cfg(unix)]
                {
                    if !link_dest.exists() {
                        let _ = std::os::unix::fs::symlink(&media.path, &link_dest);
                    }
                }
            }
        }
    }

    proj.media_files.push(media);
    proj.updated_at = chrono::Utc::now();
    write_project(&p, &proj)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;
    Ok(proj)
}

// ── IPC 类型 ──────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub path: String,
    pub project: Project,
}

// ── helpers ───────────────────────────────────────────────────────────

pub fn project_dir(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("无法获取 app data 目录: {e}")))?;
    Ok(dir.join("projects"))
}

async fn write_project(path: &Path, proj: &Project) -> Result<(), std::io::Error> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let bytes = serde_json::to_vec_pretty(proj)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    tokio::fs::write(path, bytes).await
}
