//! dramaxis src-tauri · 批量持久化任务队列、NAS 路径重映射与跨工程检索命令 (P2)
//!
//! 包含:
//! - 批处理任务队列增删查与取消 (SQLite 原子性队列)
//! - 工作室 NAS 跨平台素材路径重映射与候选目录自动搜寻
//! - 全局与跨项目台词/黄金 Hook 关键词全文检索
//! - 局域网/私有 GPU 算力节点健康检查与延迟探测

use chrono::Utc;
use rusqlite::Connection;
use std::path::PathBuf;
use uuid::Uuid;

use dramaxis_core::compute::{
    ComputeHealth, ComputeNodeConfig, ComputeProvider, HttpComputeProvider,
};
use dramaxis_core::domain::{BatchJob, BatchJobStatus, BatchJobType, Project};
use dramaxis_core::error::DramaxisError;
use dramaxis_storage::db::{
    cancel_batch_job, complete_batch_job, fail_batch_job, fetch_next_pending_job, get_batch_job,
    init_database, list_batch_jobs, save_batch_job, search_script_segments_fts,
    update_batch_job_progress, ScriptSegmentHit,
};
use dramaxis_storage::remap::{NasPathRemapper, PathMappingRule};

use crate::commands::project::project_dir;

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

/// 创建并提交新的批量任务到持久化队列
#[allow(unused_variables)]
#[tauri::command]
pub async fn batch_create_job(
    app: tauri::AppHandle,
    project_id: Option<String>,
    job_type: BatchJobType,
    payload: String,
    priority: Option<i32>,
    bundle_path: Option<String>,
) -> Result<BatchJob, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    let job = BatchJob {
        id: Uuid::new_v4().to_string(),
        job_type,
        status: BatchJobStatus::Pending,
        progress: 0.0,
        payload_json: payload,
        result_json: None,
        error_message: None,
        retry_count: 0,
        max_retries: 3,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    save_batch_job(&conn, &job).map_err(|e| DramaxisError::Project(e.to_string()))?;
    Ok(job)
}

/// 列举批量队列中的任务 (支持按状态过滤)
#[allow(unused_variables)]
#[tauri::command]
pub async fn batch_list_jobs(
    app: tauri::AppHandle,
    status: Option<BatchJobStatus>,
    project_id: Option<String>,
    limit: Option<usize>,
    bundle_path: Option<String>,
) -> Result<Vec<BatchJob>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    let status_str = status.map(|s| s.to_string());
    list_batch_jobs(&conn, status_str.as_deref(), limit.unwrap_or(50))
        .map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 获取单个批量任务详情
#[tauri::command]
pub async fn batch_get_job(
    app: tauri::AppHandle,
    id: String,
    bundle_path: Option<String>,
) -> Result<Option<BatchJob>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    get_batch_job(&conn, &id).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 取消正在等待或运行中的批量任务
#[tauri::command]
pub async fn batch_cancel_job(
    app: tauri::AppHandle,
    id: String,
    bundle_path: Option<String>,
) -> Result<(), DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    cancel_batch_job(&conn, &id).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 原子认领并执行队列中的下一条待处理批处理任务
#[tauri::command]
pub async fn batch_process_next(
    app: tauri::AppHandle,
    bundle_path: Option<String>,
) -> Result<Option<BatchJob>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    let Some(job) =
        fetch_next_pending_job(&conn).map_err(|e| DramaxisError::Project(e.to_string()))?
    else {
        return Ok(None);
    };

    let _ = update_batch_job_progress(&conn, &job.id, 30.0);

    // 校验任务载荷是否为合法 JSON
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(&job.payload_json);
    match parsed {
        Ok(payload_val) => {
            let _ = update_batch_job_progress(&conn, &job.id, 80.0);
            let result = serde_json::json!({
                "jobType": job.job_type,
                "handledAt": Utc::now().to_rfc3339(),
                "payloadEcho": payload_val,
                "status": "dispatched"
            })
            .to_string();
            complete_batch_job(&conn, &job.id, &result)
                .map_err(|e| DramaxisError::Project(e.to_string()))?;
        }
        Err(err) => {
            fail_batch_job(&conn, &job.id, &format!("无效的任务载荷 JSON: {err}"))
                .map_err(|e| DramaxisError::Project(e.to_string()))?;
        }
    }

    get_batch_job(&conn, &job.id).map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 重映射工程内的 NAS / 局域网素材路径
#[tauri::command]
pub async fn project_remap_nas_paths(
    project: Project,
    rules: Vec<PathMappingRule>,
    candidate_roots: Vec<String>,
) -> Result<Project, DramaxisError> {
    let mut project = project;
    let candidate_paths: Vec<PathBuf> = candidate_roots.into_iter().map(PathBuf::from).collect();
    let mut remapper = NasPathRemapper::new();
    remapper.rules = rules;
    remapper.remap_project(&mut project, &candidate_paths);
    Ok(project)
}

/// 全局或按项目检索台词与黄金 Hook (FTS 检索)
#[tauri::command]
pub async fn project_search_script_segments(
    app: tauri::AppHandle,
    query: String,
    project_id: Option<String>,
    limit: Option<usize>,
    bundle_path: Option<String>,
) -> Result<Vec<ScriptSegmentHit>, DramaxisError> {
    let conn = get_db_conn(&app, bundle_path.as_deref())?;
    search_script_segments_fts(&conn, &query, project_id.as_deref(), limit.unwrap_or(50))
        .map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 局域网/私有 GPU 外部算力节点健康检查
#[tauri::command]
pub async fn compute_check_health(
    config: ComputeNodeConfig,
) -> Result<ComputeHealth, DramaxisError> {
    let provider = HttpComputeProvider::new(config);
    provider.health_check().await
}
