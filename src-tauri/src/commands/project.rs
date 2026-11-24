//! src-tauri 命令 · project 完整 CRUD 与 .dramaxis 工程包持久化
//!
//! Tauri command 层: 将 SQLite WAL 存储与工程包管理器暴露为前端可调用的 IPC 指令。

use std::path::{Path, PathBuf};

use dramaxis_core::domain::{Episode, MediaFile, Project, Series, StoryBible, Variant};
use dramaxis_core::error::DramaxisError;
use dramaxis_core::services::ProjectService;
use dramaxis_core::AppContext;
use dramaxis_storage::bundle::{create_bundle, open_bundle, redo_bundle, save_bundle, undo_bundle};
use dramaxis_storage::db::{
    init_database, list_episodes, list_series, list_variants, load_story_bible, save_episode,
    save_series, save_story_bible, save_variant,
};
use rusqlite::Connection;
use tauri::{Manager, State};

/// 列举最近项目 (真实从 ProjectService 取)
#[tauri::command]
pub async fn project_list_recent(
    state: State<'_, AppContext>,
) -> Result<Vec<String>, DramaxisError> {
    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
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
) -> Result<ProjectRecord, DramaxisError> {
    let proj = Project {
        timeline: dramaxis_core::domain::Timeline::default_5tracks(),
        ..Default::default()
    };
    let base_dir = project_dir(&app).map_err(|e| DramaxisError::Io(e.to_string()))?;
    let bundle_path = base_dir.join(format!("{}.dramaxis", proj.id));

    // 1. 创建标准 .dramaxis 工程包与 SQLite 数据库
    let _bundle = create_bundle(&bundle_path, &proj)
        .map_err(|e| DramaxisError::Project(format!("创建 .dramaxis 工程包失败: {e}")))?;

    // 2. 建立兼容性本地目录骨架与 JSON 快照
    let media_dir = bundle_path.join("media");
    let _ = tokio::fs::create_dir_all(&media_dir).await;
    let legacy_json = bundle_path.join("project.dramaxis.json");
    let _ = write_project(&legacy_json, &proj).await;

    let svc = state
        .service::<ProjectService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
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
) -> Result<ProjectRecord, DramaxisError> {
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
        .map_err(|e| DramaxisError::Io(e.to_string()))?;
    let proj: Project = serde_json::from_slice(&bytes)
        .map_err(|e| DramaxisError::Project(format!("解析项目文件失败: {e}")))?;

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
pub async fn project_save(path: String, project: Project) -> Result<(), DramaxisError> {
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
        .map_err(|e| DramaxisError::Io(e.to_string()))
}

/// 执行工程包内的撤销操作 (Undo)，还原上一历史检查点
#[tauri::command]
pub async fn project_undo(
    path: String,
    project_id: String,
) -> Result<Option<Project>, DramaxisError> {
    let p = PathBuf::from(&path);
    undo_bundle(&p, &project_id).map_err(|e| DramaxisError::Project(format!("撤销失败: {e}")))
}

/// 执行工程包内的重做操作 (Redo)，重做前向历史检查点
#[tauri::command]
pub async fn project_redo(
    path: String,
    project_id: String,
) -> Result<Option<Project>, DramaxisError> {
    let p = PathBuf::from(&path);
    redo_bundle(&p, &project_id).map_err(|e| DramaxisError::Project(format!("重做失败: {e}")))
}

/// 删除指定路径的 Project 文件或工程包，并同步从最近工程列表中注销 (带严格路径边界安全校验)
#[tauri::command]
pub async fn project_delete(
    state: State<'_, AppContext>,
    path: String,
) -> Result<(), DramaxisError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        if let Ok(svc) = state.service::<ProjectService>().await {
            svc.remove_recent(&p).await;
        }
        return Ok(());
    }

    // 安全检查：坚决禁止删除系统根目录、主目录或桌面系统文件夹
    if let Ok(canonical) = p.canonicalize() {
        if canonical.parent().is_none() {
            return Err(DramaxisError::InvalidInput("拒绝删除根目录".into()));
        }
        if let Some(home) = dirs::home_dir() {
            if let Ok(home_can) = home.canonicalize() {
                if canonical == home_can {
                    return Err(DramaxisError::InvalidInput("拒绝删除用户主目录".into()));
                }
            }
        }
        if let Some(desktop) = dirs::desktop_dir() {
            if let Ok(desktop_can) = desktop.canonicalize() {
                if canonical == desktop_can {
                    return Err(DramaxisError::InvalidInput("拒绝删除桌面目录".into()));
                }
            }
        }
    }

    if p.is_file() {
        let _ = tokio::fs::remove_file(&p).await;
        // 仅当父目录确为 .dramaxis 或 .splicr 工程包时，才级联清理包目录
        if let Some(parent) = p.parent() {
            let is_bundle = parent
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext == "dramaxis" || ext == "splicr")
                .unwrap_or(false);
            if is_bundle {
                let _ = tokio::fs::remove_dir_all(parent).await;
            }
        }
    } else if p.is_dir() {
        let is_bundle = p
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext == "dramaxis" || ext == "splicr")
            .unwrap_or(false)
            || p.join("project.db").exists()
            || p.join("project.dramaxis.json").exists();

        if is_bundle {
            let _ = tokio::fs::remove_dir_all(&p).await;
        } else {
            return Err(DramaxisError::InvalidInput(
                "指定的目录并非合法的 Dramaxis 工程包，已拒绝执行级联删除".into(),
            ));
        }
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
) -> Result<Project, DramaxisError> {
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
            #[cfg(unix)]
            {
                let link_dest = media_dir.join(file_name);
                if !link_dest.exists() {
                    let _ = std::os::unix::fs::symlink(&media.path, &link_dest);
                }
            }
            #[cfg(windows)]
            {
                let link_dest = media_dir.join(file_name);
                if !link_dest.exists() {
                    let _ = std::os::windows::fs::symlink_file(&media.path, &link_dest);
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
            .map_err(|e| DramaxisError::Io(e.to_string()))?;
    }

    Ok(proj)
}

fn get_db_conn(
    app: &tauri::AppHandle,
    bundle_path: Option<&str>,
) -> Result<Connection, DramaxisError> {
    if let Some(bp) = bundle_path {
        let p = PathBuf::from(bp);
        let bundle = dramaxis_storage::bundle::DramaxisBundle::new(p);
        bundle
            .connect()
            .map_err(|e| DramaxisError::Project(e.to_string()))
    } else {
        let base_dir = project_dir(app).map_err(|e| DramaxisError::Io(e.to_string()))?;
        let _ = std::fs::create_dir_all(&base_dir);
        let db_path = base_dir.join("library.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| DramaxisError::Project(format!("打开资料库数据库失败: {e}")))?;
        init_database(&conn)
            .map_err(|e| DramaxisError::Project(format!("初始化资料库数据库失败: {e}")))?;
        Ok(conn)
    }
}

/// 保存/更新剧集总括 (Series)
#[tauri::command]
pub async fn project_series_save(
    app: tauri::AppHandle,
    series: Series,
    bundle_path: Option<String>,
) -> Result<(), DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    save_series(&conn, &series).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 列出所有剧集 (Series)
#[tauri::command]
pub async fn project_series_list(
    app: tauri::AppHandle,
    bundle_path: Option<String>,
) -> Result<Vec<Series>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    list_series(&conn).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 保存/更新设定集 (StoryBible)
#[tauri::command]
pub async fn project_story_bible_save(
    app: tauri::AppHandle,
    bible: StoryBible,
    bundle_path: Option<String>,
) -> Result<(), DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    save_story_bible(&conn, &bible).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 加载指定剧集的设定集 (StoryBible)
#[tauri::command]
pub async fn project_story_bible_load(
    app: tauri::AppHandle,
    series_id: String,
    bundle_path: Option<String>,
) -> Result<Option<StoryBible>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    load_story_bible(&conn, &series_id).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 保存/更新单集分集拆条 (Episode)
#[tauri::command]
pub async fn project_episode_save(
    app: tauri::AppHandle,
    episode: Episode,
    bundle_path: Option<String>,
) -> Result<(), DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    save_episode(&conn, &episode).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 列出指定剧集下的所有分集 (Episode)
#[tauri::command]
pub async fn project_episode_list(
    app: tauri::AppHandle,
    series_id: String,
    bundle_path: Option<String>,
) -> Result<Vec<Episode>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    list_episodes(&conn, &series_id).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 保存/更新解说变体分支 (Variant)
#[tauri::command]
pub async fn project_variant_save(
    app: tauri::AppHandle,
    variant: Variant,
    bundle_path: Option<String>,
) -> Result<(), DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    save_variant(&conn, &variant).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 列出指定单集下的所有解说变体分支 (Variant)
#[tauri::command]
pub async fn project_variant_list(
    app: tauri::AppHandle,
    episode_id: String,
    bundle_path: Option<String>,
) -> Result<Vec<Variant>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    list_variants(&conn, &episode_id).map_err(|e| DramaxisError::Project(e.to_string()))
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
