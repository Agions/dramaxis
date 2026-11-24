//! src-tauri 命令 · assets (素材资产管理)
//!
//! - assets_scan       : 扫描目录,返回可导入素材列表
//! - assets_metadata   : ffprobe 抽取单个素材元数据
//! - assets_thumbnail  : ffmpeg 生成首帧缩略图
//! - assets_search     : 在已有 media_files 中按 substring 过滤
//!
//! 所有命令通过 `AppContext.services` 解析 `AssetService` 单例。

use dramaxis_core::error::DramaxisError;
use dramaxis_core::AppContext;
use dramaxis_detect::FfmpegProbe;
use dramaxis_intake::proxy::{
    extract_audio_peaks, generate_proxy_video, ProxyArtifact, ProxyConfig, WaveformPeaks,
};
use dramaxis_storage::{AssetService, ScanResult, ThumbnailResult};
use tauri::{Manager, State};

/// 扫描目录,返回可导入素材条目列表
#[tauri::command]
pub async fn assets_scan(
    state: State<'_, AppContext>,
    dir: String,
    recursive: Option<bool>,
) -> Result<ScanResult, DramaxisError> {
    let svc = state
        .service::<AssetService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
    svc.scan(&dir, recursive.unwrap_or(false))
        .map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 提取单个素材的元数据 (duration / resolution / codec / size)
#[tauri::command]
pub async fn assets_metadata(
    state: State<'_, AppContext>,
    path: String,
) -> Result<FfmpegProbe, DramaxisError> {
    let svc = state
        .service::<AssetService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
    svc.metadata(&path)
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 生成首帧缩略图,返回本地路径
#[tauri::command]
pub async fn assets_thumbnail(
    state: State<'_, AppContext>,
    path: String,
    width: Option<u32>,
) -> Result<ThumbnailResult, DramaxisError> {
    let svc = state
        .service::<AssetService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
    svc.thumbnail(&path, width.unwrap_or(320))
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))
}

/// 在已有 media_files 中按 substring 过滤
#[tauri::command]
pub async fn assets_search(
    state: State<'_, AppContext>,
    media_paths: Vec<String>,
    pattern: String,
) -> Result<Vec<String>, DramaxisError> {
    let svc = state
        .service::<AssetService>()
        .await
        .map_err(|e| DramaxisError::Project(e.to_string()))?;
    Ok(svc.search(&media_paths, &pattern))
}

/// 生成或复用 720p GOP=15 代理剪辑流 (P1-3)
#[tauri::command]
pub async fn assets_generate_proxy(
    app: tauri::AppHandle,
    source_path: String,
    config: Option<ProxyConfig>,
) -> Result<ProxyArtifact, DramaxisError> {
    let p = std::path::PathBuf::from(&source_path);
    if !p.exists() {
        return Err(DramaxisError::InvalidInput(format!(
            "素材文件不存在: {source_path}"
        )));
    }
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| DramaxisError::Io(e.to_string()))?
        .join("proxies");
    let cfg = config.unwrap_or_default();
    let cancel = dramaxis_core::CancelToken::new();
    generate_proxy_video(&p, &cache_dir, &cfg, &cancel)
        .await
        .map_err(DramaxisError::Ffmpeg)
}

/// 提取并缓存音频波形归一化峰值数据 (P1-3)
#[tauri::command]
pub async fn assets_get_waveform_peaks(
    app: tauri::AppHandle,
    source_path: String,
    buckets: Option<usize>,
) -> Result<WaveformPeaks, DramaxisError> {
    let p = std::path::PathBuf::from(&source_path);
    if !p.exists() {
        return Err(DramaxisError::InvalidInput(format!(
            "素材文件不存在: {source_path}"
        )));
    }
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| DramaxisError::Io(e.to_string()))?
        .join("waveforms");
    let cancel = dramaxis_core::CancelToken::new();
    extract_audio_peaks(&p, &cache_dir, buckets.unwrap_or(200), &cancel)
        .await
        .map_err(DramaxisError::Ffmpeg)
}
