//! src-tauri 命令 · project 完整 CRUD 与 .dramaxis 工程包持久化
//!
//! Tauri command 层: 将 SQLite WAL 存储与工程包管理器暴露为前端可调用的 IPC 指令。

use std::path::{Path, PathBuf};

use dramaxis_core::domain::{MediaFile, Project};
use dramaxis_core::error::SplicrError;
use dramaxis_core::services::ProjectService;
use dramaxis_core::AppContext;
use dramaxis_storage::bundle::{create_bundle, open_bundle, redo_bundle, save_bundle, undo_bundle};
use tauri::{Manager, State};

/// 列举最近项目 (真实从 ProjectService 取)
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

/// 创建空白 Project 并生成标准 .dramaxis 工程包容器。
/// 返回 (path, project) 元组: 前端用 path 记住文件位置。
#[tauri::command]
pub async fn project_create_blank(
    app: tauri::AppHandle,
    state: State<'_, AppContext>,
) -> Result<ProjectRecord, SplicrError> {
    let proj = Project {
        timeline: dramaxis_core::domain::Timeline::default_5tracks(),
        ..Default::default()
    };
    let base_dir = project_dir(&app).map_err(|e| SplicrError::Io(e.to_string()))?;
    let bundle_path = base_dir.join(format!("{}.dramaxis", &proj.id));

    // 1. 创建标准 .dramaxis 工程包与 SQLite 数据库
    let _bundle = create_bundle(&bundle_path, &proj)
        .map_err(|e| SplicrError::Project(format!("创建 .dramaxis 工程包失败: {e}")))?;

    // 2. 建立兼容性本地目录骨架与 JSON 快照
    let media_dir = bundle_path.join("media");
    let _ = tokio::fs::create_dir_all(&media_dir).await;
    let legacy_json = bundle_path.join("project.dramaxis.json");
    let _ = write_project(&legacy_json, &proj).await;

    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| SplicrError::Project(e.to_string()))?;
    svc.push_recent(bundle_path.clone()).await;

    Ok(ProjectRecord {
        path: bundle_path.to_string_lossy().into_owned(),
        project: proj,
    })
}

/// 从指定路径加载 Project (原生支持 .dramaxis 包、遗留 .json / .splicr 自动无损迁移)
#[tauri::command]
pub async fn project_load(
    path: String,
    state: State<'_, AppContext>,
) -> Result<ProjectRecord, SplicrError> {
    let p = PathBuf::from(&path);

    // 1. 优先尝试通过 .dramaxis 工程包加载（包含遗留 JSON 自动升级）
    if let Ok((bundle, project)) = open_bundle(&p) {
        if let Ok(svc) = state.service::<ProjectService>().await {
            svc.push_recent(bundle.path.clone()).await;
        }
        return Ok(ProjectRecord {
            path: bundle.path.to_string_lossy().into_owned(),
            project,
        });
    }

    // 2. 回退：直接从单文件 JSON 反序列化
    let mut fallback_file = p.clone();
    if fallback_file.is_dir() {
        let candidate = fallback_file.join("project.dramaxis.json");
        if candidate.exists() {
            fallback_file = candidate;
        }
    }

    let bytes = tokio::fs::read(&fallback_file)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))?;
    let proj: Project = serde_json::from_slice(&bytes)
        .map_err(|e| SplicrError::Project(format!("解析项目文件失败: {e}")))?;

    if let Ok(svc) = state.service::<ProjectService>().await {
        svc.push_recent(fallback_file.clone()).await;
    }

    Ok(ProjectRecord {
        path: fallback_file.to_string_lossy().into_owned(),
        project: proj,
    })
}

/// 把 Project 落盘到指定工程包或路径 (写入 SQLite WAL 事务并保存 Checkpoint)
#[tauri::command]
pub async fn project_save(path: String, project: Project) -> Result<(), SplicrError> {
    let p = PathBuf::from(&path);

    // 1. 若为 .dramaxis 工程包或包含 project.db 的目录，使用 SQLite WAL 保存
    let is_bundle = p.extension().and_then(|ext| ext.to_str()) == Some("dramaxis")
        || p.join("project.db").exists();

    if is_bundle {
        if let Err(e) = save_bundle(&p, &project, Some("手动保存")) {
            tracing::warn!(err = %e, "SQLite 保存遇到警告，回退写入快照");
        }
        // 同步写一份兼容性 JSON 快照
        let snapshot = p.join("project.dramaxis.json");
        let _ = write_project(&snapshot, &project).await;
        return Ok(());
    }

    // 2. 否则按单文件或普通目录保存
    write_project(&p, &project)
        .await
        .map_err(|e| SplicrError::Io(e.to_string()))
}

/// 执行工程包内的撤销操作 (Undo)，还原上一历史检查点
#[tauri::command]
pub async fn project_undo(
    path: String,
    project_id: String,
) -> Result<Option<Project>, SplicrError> {
    let p = PathBuf::from(&path);
    undo_bundle(&p, &project_id).map_err(|e| SplicrError::Project(format!("撤销失败: {e}")))
}

/// 执行工程包内的重做操作 (Redo)，重做前向历史检查点
#[tauri::command]
pub async fn project_redo(
    path: String,
    project_id: String,
) -> Result<Option<Project>, SplicrError> {
    let p = PathBuf::from(&path);
    redo_bundle(&p, &project_id).map_err(|e| SplicrError::Project(format!("重做失败: {e}")))
}

/// 删除指定路径的 Project 文件或工程包，并同步从最近工程列表中注销
#[tauri::command]
pub async fn project_delete(state: State<'_, AppContext>, path: String) -> Result<(), SplicrError> {
    let p = PathBuf::from(&path);
    if p.is_file() {
        let _ = tokio::fs::remove_file(&p).await;
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

    // 如果处于工程包目录内，在 media/ 目录下建立软链接
    let media_dir = if p.is_dir() {
        p.join("media")
    } else if let Some(parent) = p.parent() {
        parent.join("media")
    } else {
        PathBuf::from("media")
    };

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

    proj.media_files.push(media);
    proj.updated_at = chrono::Utc::now();

    // 保存到工程包与快照
    let is_bundle = p.extension().and_then(|ext| ext.to_str()) == Some("dramaxis")
        || p.join("project.db").exists();
    if is_bundle {
        let _ = save_bundle(&p, &proj, Some("添加素材"));
        let _ = write_project(&p.join("project.dramaxis.json"), &proj).await;
    } else {
        write_project(&p, &proj)
            .await
            .map_err(|e| SplicrError::Io(e.to_string()))?;
    }

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
