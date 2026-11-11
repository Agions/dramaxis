//! src-tauri 命令 · 视频导出、8 维消重矩阵与剪映草稿交付
//!
//! 宿主薄分发层 (Thin IPC Adapter):
//! - export_plan: 按 quick/custom/silent 模式生成导出计划
//! - export_validate_params: 校验自定义编码参数
//! - export_render_subtitles: 渲染字幕文本
//! - video_build_plans: 按 4 策略生成多视频编排计划
//! - export_capcut_draft: 导出剪映工程草稿
//! - export_get_dedup_preset: 获取消重预设
//! - export_render_video: 调度 GPU 加速流水线压制成片
//! - export_batch_fission: 批量并发生成独特指纹裂变视频
//! - export_open_folder: 打开本地文件夹
//! - export_launch_jianying: 唤起剪映 PC 客户端

use std::path::PathBuf;

use dramaxis_core::domain::{ExportStrategy, ProjectSettings};
use dramaxis_core::error::DramaxisError;
pub use dramaxis_export::capcut::{CapcutDraftOptions, CapcutDraftResult};
pub use dramaxis_export::dedup::{DedupIntensity, DedupOptions};
pub use dramaxis_export::renderer::{
    BatchFissionParams, BatchFissionResult, FissionProgressPayload, RenderProgressPayload,
    RenderVideoParams, RenderVideoResult,
};
use dramaxis_export::{
    create_capcut_draft, execute_batch_fission, render_subtitles, render_video_pipeline,
    validate_params, ExportMode, ExportParams, ExportPlan, ExportPlanner, SubtitleFormat,
    SubtitleItem,
};
use dramaxis_intake::{build_plans, OutputPlan, PlanOptions};
use tauri::{Emitter, Manager};

/// 按模式生成导出计划
#[tauri::command]
pub async fn export_plan(
    mode: ExportMode,
    settings: Option<ProjectSettings>,
) -> Result<ExportPlan, DramaxisError> {
    ExportPlanner::new()
        .plan(mode, settings.as_ref())
        .map_err(|e| DramaxisError::InvalidInput(e.to_string()))
}

/// 校验自定义编码参数
#[tauri::command]
pub async fn export_validate_params(params: ExportParams) -> Result<(), DramaxisError> {
    validate_params(&params).map_err(|e| DramaxisError::InvalidInput(e.to_string()))
}

/// 渲染字幕文本 (SRT / ASS / VTT)
#[tauri::command]
pub async fn export_render_subtitles(
    items: Vec<SubtitleItem>,
    format: SubtitleFormat,
) -> Result<String, DramaxisError> {
    render_subtitles(&items, format).map_err(|e| DramaxisError::InvalidInput(e.to_string()))
}

/// 按 4 策略生成多视频编排计划
#[tauri::command]
pub async fn video_build_plans(
    sources: Vec<PathBuf>,
    strategy: ExportStrategy,
    options: Option<PlanOptions>,
) -> Result<Vec<OutputPlan>, DramaxisError> {
    let opts = options.unwrap_or_default();
    build_plans(&sources, strategy, &opts).map_err(|e| DramaxisError::InvalidInput(e.to_string()))
}

/// 导出剪映工程草稿 (.draft 完整多轨与材料)
#[tauri::command]
pub async fn export_capcut_draft(
    params: CapcutDraftOptions,
) -> Result<CapcutDraftResult, DramaxisError> {
    create_capcut_draft(params)
}

/// 获取 8 维消重矩阵预设 (轻度/标准/强力)
#[tauri::command]
pub async fn export_get_dedup_preset(
    intensity: DedupIntensity,
) -> Result<DedupOptions, DramaxisError> {
    Ok(match intensity {
        DedupIntensity::Mild => DedupOptions::mild(),
        DedupIntensity::Standard => DedupOptions::standard(),
        DedupIntensity::Aggressive => DedupOptions::aggressive(),
        DedupIntensity::Custom => DedupOptions::standard(),
    })
}

/// 使用 FFmpeg 压制渲染视频 (GPU 加速 + 8 维消重 + 环境模糊 + 侧链闪避)
#[tauri::command]
pub async fn export_render_video(
    app_handle: tauri::AppHandle,
    params: RenderVideoParams,
) -> Result<RenderVideoResult, DramaxisError> {
    let preset = params.platform_preset.as_deref().unwrap_or("douyin");

    let output_file: PathBuf = if let Some(out) = params.output_path {
        PathBuf::from(out)
    } else {
        let download_dir = app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        let filename = format!(
            "dramaxis_{}_{}.mp4",
            preset.to_lowercase().replace([' ', '/'], "_"),
            chrono::Utc::now().timestamp_millis()
        );
        download_dir.join(filename)
    };

    let mut dedup = params.dedup.unwrap_or_default();
    if let Some(z) = params.anti_dup_zoom {
        dedup.enable_zoom = true;
        dedup.zoom_rate = z;
    }

    let enable_blur = params.enable_ambient_blur.unwrap_or(true);
    let app_clone = app_handle.clone();

    let (total_duration, size_bytes) = render_video_pipeline(
        &params.video_path,
        params.voice_path.as_deref(),
        &params.subtitles,
        Some(preset),
        enable_blur,
        &dedup,
        params.scene_cuts.as_deref(),
        params.bgm_path.as_deref(),
        params.bgm_volume,
        params.enable_audio_ducking.unwrap_or(true),
        params.subtitle_style.as_deref(),
        &output_file,
        Some(Box::new(move |secs: f64| {
            let pct = (secs / 60.0 * 100.0).clamp(0.0, 99.0);
            let _ = app_clone.emit(
                "export://progress",
                RenderProgressPayload {
                    percent: pct,
                    time_seconds: secs,
                    phase: "rendering".into(),
                },
            );
        })),
    )
    .await?;

    let _ = app_handle.emit(
        "export://progress",
        RenderProgressPayload {
            percent: 100.0,
            time_seconds: total_duration,
            phase: "completed".into(),
        },
    );

    Ok(RenderVideoResult {
        output_path: output_file.to_string_lossy().to_string(),
        duration_seconds: total_duration,
        size_bytes,
    })
}

/// 批量裂变引擎: 基于 8 维消重矩阵生成 N 份参数各异的防重成片
#[tauri::command]
pub async fn export_batch_fission(
    app_handle: tauri::AppHandle,
    params: BatchFissionParams,
) -> Result<BatchFissionResult, DramaxisError> {
    let output_dir: PathBuf = if let Some(dir) = &params.output_dir {
        PathBuf::from(dir)
    } else {
        let download_dir = app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        download_dir.join(format!("fission_{}", chrono::Utc::now().timestamp_millis()))
    };

    let app_clone = app_handle.clone();
    let res = execute_batch_fission(params, &output_dir, move |idx, total, pct, msg| {
        let _ = app_clone.emit(
            "export://fission_progress",
            FissionProgressPayload {
                current_index: idx,
                total_count: total,
                percent: pct,
                message: msg,
            },
        );
    })
    .await?;

    Ok(res)
}

/// 在操作系统文件资源管理器中安全打开指定路径
#[tauri::command]
pub async fn export_open_folder(path: String) -> Result<(), DramaxisError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(DramaxisError::Io(format!("目标路径不存在: {path}")));
    }

    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| DramaxisError::Io(format!("调用 open 命令失败: {e}")))?;
    }

    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| DramaxisError::Io(format!("调用 explorer 失败: {e}")))?;
    }

    #[cfg(target_os = "linux")]
    {
        let target = if p.is_dir() {
            p
        } else {
            p.parent().unwrap_or(&p).to_path_buf()
        };
        tokio::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| DramaxisError::Io(format!("调用 xdg-open 失败: {e}")))?;
    }

    Ok(())
}

/// 唤起本机剪映 PC 客户端
#[tauri::command]
pub async fn export_launch_jianying() -> Result<(), DramaxisError> {
    #[cfg(target_os = "macos")]
    {
        let status = tokio::process::Command::new("open")
            .args(["-a", "JianyingPro"])
            .status()
            .await;
        if status.is_err() || !status.as_ref().unwrap().success() {
            let alt_status = tokio::process::Command::new("open")
                .args(["-a", "剪映专业版"])
                .status()
                .await;
            if alt_status.is_err() || !alt_status.unwrap().success() {
                return Err(DramaxisError::Other(
                    "未能在本机发现已安装的剪映专业版应用程序".into(),
                ));
            }
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let possible_exe = std::path::PathBuf::from(local_app_data)
                .join("JianyingPro")
                .join("Apps")
                .join("JianyingPro.exe");
            if possible_exe.exists() {
                tokio::process::Command::new(possible_exe)
                    .spawn()
                    .map_err(|e| DramaxisError::Io(format!("启动剪映失败: {e}")))?;
                return Ok(());
            }
        }
        Err(DramaxisError::Other(
            "未能在本机默认路径发现剪映可执行文件".into(),
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err(DramaxisError::Other(
            "Linux 及其他平台暂不支持直接唤起剪映客户端".into(),
        ))
    }
}
