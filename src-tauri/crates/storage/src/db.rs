//! dramaxis-storage::db · 嵌入式 SQLite 核心数据持久化与 Undo/Redo 引擎
//!
//! ## 设计原则
//! - 采用 SQLite WAL 模式与 FOREIGN KEY 级联，保证 100% ACID 崩溃安全性
//! - 时间轴片段与剧本分段支持增量顺序存取
//! - 提供操作快照历史栈，支持秒级 Undo / Redo

use crate::patch::{apply_patch, diff_json, PatchOp};
use chrono::{DateTime, Utc};
use dramaxis_core::domain::{
    BatchJob, BatchJobStatus, BatchJobType, Clip, Episode, ExportRecord, ExportStrategy, MediaFile,
    PlatformId, Project, ProjectSettings, ScriptSegment, Series, StoryBible, Timeline, Track,
    TrackKind, Variant,
};
use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 每隔多少步增量 Patch 写入一次全量关键帧快照
const UNDO_KEYFRAME_INTERVAL: usize = 20;
/// 单项目撤销栈最大保留步数
const UNDO_MAX_DEPTH: usize = 200;

/// Multi-Agent 状态图断点持久化记录
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentCheckpointRecord {
    pub id: i64,
    pub session_id: String,
    pub project_id: String,
    pub node_id: String,
    pub workflow_profile: String,
    pub blackboard_json: String,
    pub dag_snapshot_json: String,
    pub created_at: String,
}

/// 初始化数据库 Schema 与性能 Pragma
pub fn init_database(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            settings_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media_assets (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            duration_seconds REAL NOT NULL,
            resolution TEXT,
            codec TEXT,
            file_size_bytes INTEGER NOT NULL,
            import_time TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS timeline_tracks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            track_order INTEGER NOT NULL,
            kind TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS timeline_clips (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            track_id TEXT NOT NULL REFERENCES timeline_tracks(id) ON DELETE CASCADE,
            clip_order INTEGER NOT NULL,
            media_ref TEXT NOT NULL,
            start_seconds REAL NOT NULL,
            in_seconds REAL NOT NULL,
            out_seconds REAL NOT NULL,
            volume REAL
        );

        CREATE TABLE IF NOT EXISTS script_segments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            segment_order INTEGER NOT NULL,
            step_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            emotion TEXT,
            start_seconds REAL,
            end_seconds REAL,
            is_hook INTEGER,
            hook_style TEXT,
            visual_cut_ref TEXT,
            score REAL,
            dirty_flag INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS exports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            strategy TEXT NOT NULL,
            output_path TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            success INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS undo_redo_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            action_name TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_undone INTEGER DEFAULT 0,
            is_keyframe INTEGER NOT NULL DEFAULT 1,
            patch_json TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_checkpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            workflow_profile TEXT NOT NULL,
            blackboard_json TEXT NOT NULL,
            dag_snapshot_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS series (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            default_style TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS story_bibles (
            series_id TEXT PRIMARY KEY REFERENCES series(id) ON DELETE CASCADE,
            bible_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
            episode_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            source_paths_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS variants (
            id TEXT PRIMARY KEY,
            episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
            project_id TEXT NOT NULL,
            label TEXT NOT NULL,
            style_preset TEXT NOT NULL,
            target_platform TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS batch_jobs (
            id TEXT PRIMARY KEY,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            result_json TEXT,
            error_message TEXT,
            progress REAL NOT NULL DEFAULT 0.0,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_media_project ON media_assets(project_id);
        CREATE INDEX IF NOT EXISTS idx_tracks_project ON timeline_tracks(project_id, track_order);
        CREATE INDEX IF NOT EXISTS idx_clips_track ON timeline_clips(track_id, clip_order);
        CREATE INDEX IF NOT EXISTS idx_scripts_project ON script_segments(project_id, segment_order);
        CREATE INDEX IF NOT EXISTS idx_undo_project ON undo_redo_log(project_id, id);
        CREATE INDEX IF NOT EXISTS idx_agent_ckpt_session ON agent_checkpoints(session_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_agent_ckpt_project ON agent_checkpoints(project_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_episodes_series ON episodes(series_id, episode_number);
        CREATE INDEX IF NOT EXISTS idx_variants_episode ON variants(episode_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status, created_at);
        "#,
    )?;

    // 幂等列迁移：兼容旧版无 is_keyframe / patch_json 列的数据库文件
    let _ = conn.execute(
        "ALTER TABLE undo_redo_log ADD COLUMN is_keyframe INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE undo_redo_log ADD COLUMN patch_json TEXT",
        [],
    );

    Ok(())
}

/// 原子化保存整个 Project 状态到 SQLite
pub fn save_project(conn: &mut Connection, project: &Project) -> SqlResult<()> {
    let tx = conn.transaction()?;

    let settings_json = serde_json::to_string(&project.settings).unwrap_or_default();
    let version_str = project.version.to_string();
    let created_at_str = project.created_at.to_rfc3339();
    let updated_at_str = Utc::now().to_rfc3339();

    // 1. 插入或更新 Project
    tx.execute(
        r#"
        INSERT INTO projects (id, name, version, created_at, updated_at, settings_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            version = excluded.version,
            updated_at = excluded.updated_at,
            settings_json = excluded.settings_json;
        "#,
        params![
            project.id,
            project.name,
            version_str,
            created_at_str,
            updated_at_str,
            settings_json,
        ],
    )?;

    // 2. 清理旧的关系数据（级联或直接删除）
    tx.execute(
        "DELETE FROM media_assets WHERE project_id = ?1",
        params![project.id],
    )?;
    tx.execute(
        "DELETE FROM timeline_clips WHERE project_id = ?1",
        params![project.id],
    )?;
    tx.execute(
        "DELETE FROM timeline_tracks WHERE project_id = ?1",
        params![project.id],
    )?;
    tx.execute(
        "DELETE FROM script_segments WHERE project_id = ?1",
        params![project.id],
    )?;
    tx.execute(
        "DELETE FROM exports WHERE project_id = ?1",
        params![project.id],
    )?;

    // 3. 插入媒体资产
    for (idx, m) in project.media_files.iter().enumerate() {
        let asset_id = format!("{}-asset-{}", project.id, idx);
        tx.execute(
            r#"
            INSERT INTO media_assets (id, project_id, path, duration_seconds, resolution, codec, file_size_bytes, import_time)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                asset_id,
                project.id,
                m.path.to_string_lossy().to_string(),
                m.duration_seconds,
                m.resolution,
                m.codec,
                m.file_size_bytes as i64,
                m.import_time.to_rfc3339(),
            ],
        )?;
    }

    // 4. 插入时间线轨道与片段
    for (t_idx, track) in project.timeline.tracks.iter().enumerate() {
        let kind_str = match track.kind {
            TrackKind::Video => "video",
            TrackKind::Voice => "voice",
            TrackKind::Ambient => "ambient",
            TrackKind::Bgm => "bgm",
            TrackKind::Subtitle => "subtitle",
            TrackKind::Audio => "audio",
        };

        tx.execute(
            r#"
            INSERT INTO timeline_tracks (id, project_id, track_order, kind)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![track.id, project.id, t_idx as i64, kind_str],
        )?;

        for (c_idx, clip) in track.clips.iter().enumerate() {
            tx.execute(
                r#"
                INSERT INTO timeline_clips (id, project_id, track_id, clip_order, media_ref, start_seconds, in_seconds, out_seconds, volume)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    clip.id,
                    project.id,
                    track.id,
                    c_idx as i64,
                    clip.media_ref.to_string_lossy().to_string(),
                    clip.start_seconds,
                    clip.in_seconds,
                    clip.out_seconds,
                    clip.volume.map(|v| v as f64),
                ],
            )?;
        }
    }

    // 5. 插入剧本分段
    for (s_idx, seg) in project.scripts.iter().enumerate() {
        tx.execute(
            r#"
            INSERT INTO script_segments (
                id, project_id, segment_order, step_index, text, emotion,
                start_seconds, end_seconds, is_hook, hook_style, visual_cut_ref, score
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                seg.id,
                project.id,
                s_idx as i64,
                seg.step_index as i64,
                seg.text,
                seg.emotion,
                seg.start_seconds,
                seg.end_seconds,
                seg.is_hook.map(|b| if b { 1 } else { 0 }),
                seg.hook_style,
                seg.visual_cut_ref,
                seg.score.map(|s| s as f64),
            ],
        )?;
    }

    // 6. 插入导出记录
    for exp in &project.exports {
        let strategy_str = match exp.strategy {
            ExportStrategy::Single => "single",
            ExportStrategy::Concat => "concat",
            ExportStrategy::Batch => "batch",
            ExportStrategy::Series => "series",
        };

        tx.execute(
            r#"
            INSERT INTO exports (id, project_id, strategy, output_path, started_at, finished_at, success)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                exp.id,
                project.id,
                strategy_str,
                exp.output_path.to_string_lossy().to_string(),
                exp.started_at.to_rfc3339(),
                exp.finished_at.map(|d| d.to_rfc3339()),
                if exp.success { 1 } else { 0 },
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}

/// 从 SQLite 还原整个 Project 领域对象
pub fn load_project(conn: &Connection, project_id: Option<&str>) -> SqlResult<Option<Project>> {
    let mut stmt = if project_id.is_some() {
        conn.prepare(
            "SELECT id, name, version, created_at, updated_at, settings_json FROM projects WHERE id = ?1",
        )?
    } else {
        conn.prepare(
            "SELECT id, name, version, created_at, updated_at, settings_json FROM projects ORDER BY updated_at DESC LIMIT 1",
        )?
    };

    let project_row = if let Some(pid) = project_id {
        stmt.query_row(params![pid], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
    } else {
        stmt.query_row([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
    };

    let (id, name, version_str, created_at_str, updated_at_str, settings_json) = match project_row {
        Ok(data) => data,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e),
    };

    let version =
        semver::Version::parse(&version_str).unwrap_or_else(|_| semver::Version::new(1, 0, 1));
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let settings: ProjectSettings = serde_json::from_str(&settings_json).unwrap_or_default();

    // 1. 读取媒体文件
    let mut media_stmt = conn.prepare(
        r#"
        SELECT path, duration_seconds, resolution, codec, file_size_bytes, import_time
        FROM media_assets WHERE project_id = ?1
        "#,
    )?;
    let media_rows = media_stmt.query_map(params![id], |row| {
        let path_str: String = row.get(0)?;
        let duration_seconds: f64 = row.get(1)?;
        let resolution: Option<String> = row.get(2)?;
        let codec: Option<String> = row.get(3)?;
        let file_size_bytes: i64 = row.get(4)?;
        let import_time_str: String = row.get(5)?;
        let import_time = DateTime::parse_from_rfc3339(&import_time_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        Ok(MediaFile {
            path: PathBuf::from(path_str),
            duration_seconds,
            resolution,
            codec,
            file_size_bytes: file_size_bytes as u64,
            import_time,
        })
    })?;

    let mut media_files = Vec::new();
    for m in media_rows {
        media_files.push(m?);
    }

    // 2. 读取时间线轨道与片段
    let mut track_stmt = conn.prepare(
        "SELECT id, kind FROM timeline_tracks WHERE project_id = ?1 ORDER BY track_order ASC",
    )?;
    let track_rows = track_stmt.query_map(params![id], |row| {
        let track_id: String = row.get(0)?;
        let kind_str: String = row.get(1)?;
        let kind = match kind_str.as_str() {
            "video" => TrackKind::Video,
            "voice" => TrackKind::Voice,
            "ambient" => TrackKind::Ambient,
            "bgm" => TrackKind::Bgm,
            "subtitle" => TrackKind::Subtitle,
            _ => TrackKind::Audio,
        };
        Ok((track_id, kind))
    })?;

    let mut tracks = Vec::new();
    for t in track_rows {
        let (track_id, kind) = t?;
        let mut clip_stmt = conn.prepare(
            r#"
            SELECT id, media_ref, start_seconds, in_seconds, out_seconds, volume
            FROM timeline_clips
            WHERE track_id = ?1
            ORDER BY clip_order ASC
            "#,
        )?;
        let clip_rows = clip_stmt.query_map(params![track_id], |row| {
            let clip_id: String = row.get(0)?;
            let media_ref_str: String = row.get(1)?;
            let start_seconds: f64 = row.get(2)?;
            let in_seconds: f64 = row.get(3)?;
            let out_seconds: f64 = row.get(4)?;
            let volume: Option<f64> = row.get(5)?;

            Ok(Clip {
                id: clip_id,
                media_ref: PathBuf::from(media_ref_str),
                start_seconds,
                in_seconds,
                out_seconds,
                volume: volume.map(|v| v as f32),
            })
        })?;

        let mut clips = Vec::new();
        for c in clip_rows {
            clips.push(c?);
        }

        tracks.push(Track {
            id: track_id,
            kind,
            clips,
        });
    }

    // 3. 读取剧本分段
    let mut script_stmt = conn.prepare(
        r#"
        SELECT id, step_index, text, emotion, start_seconds, end_seconds, is_hook, hook_style, visual_cut_ref, score
        FROM script_segments
        WHERE project_id = ?1
        ORDER BY segment_order ASC
        "#,
    )?;
    let script_rows = script_stmt.query_map(params![id], |row| {
        let seg_id: String = row.get(0)?;
        let step_index: i64 = row.get(1)?;
        let text: String = row.get(2)?;
        let emotion: Option<String> = row.get(3)?;
        let start_seconds: Option<f64> = row.get(4)?;
        let end_seconds: Option<f64> = row.get(5)?;
        let is_hook_int: Option<i64> = row.get(6)?;
        let hook_style: Option<String> = row.get(7)?;
        let visual_cut_ref: Option<String> = row.get(8)?;
        let score: Option<f64> = row.get(9)?;

        Ok(ScriptSegment {
            id: seg_id,
            step_index: step_index as u8,
            text,
            emotion,
            start_seconds,
            end_seconds,
            is_hook: is_hook_int.map(|i| i != 0),
            hook_style,
            visual_cut_ref,
            score: score.map(|s| s as f32),
            ..Default::default()
        })
    })?;

    let mut scripts = Vec::new();
    for s in script_rows {
        scripts.push(s?);
    }

    // 4. 读取导出记录
    let mut exp_stmt = conn.prepare(
        r#"
        SELECT id, strategy, output_path, started_at, finished_at, success
        FROM exports WHERE project_id = ?1 ORDER BY started_at DESC
        "#,
    )?;
    let exp_rows = exp_stmt.query_map(params![id], |row| {
        let exp_id: String = row.get(0)?;
        let strategy_str: String = row.get(1)?;
        let output_path_str: String = row.get(2)?;
        let started_at_str: String = row.get(3)?;
        let finished_at_str: Option<String> = row.get(4)?;
        let success_int: i64 = row.get(5)?;

        let strategy = match strategy_str.as_str() {
            "concat" => ExportStrategy::Concat,
            "batch" => ExportStrategy::Batch,
            "series" => ExportStrategy::Series,
            _ => ExportStrategy::Single,
        };
        let started_at = DateTime::parse_from_rfc3339(&started_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let finished_at = finished_at_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        Ok(ExportRecord {
            id: exp_id,
            strategy,
            output_path: PathBuf::from(output_path_str),
            started_at,
            finished_at,
            success: success_int != 0,
        })
    })?;

    let mut exports = Vec::new();
    for e in exp_rows {
        exports.push(e?);
    }

    Ok(Some(Project {
        id,
        name,
        created_at,
        updated_at,
        version,
        settings,
        media_files,
        timeline: Timeline { tracks },
        scripts,
        exports,
    }))
}

/// 从指定 undo_redo_log 记录 ID 重建完整 Project JSON（支持关键帧 + 增量 Patch 链）
fn reconstruct_value_at(
    tx: &rusqlite::Transaction<'_>,
    project_id: &str,
    target_id: i64,
) -> SqlResult<Option<serde_json::Value>> {
    // 1. 定位 target_id 之前（含自身）最近的关键帧
    let keyframe: Option<(i64, String)> = tx
        .query_row(
            r#"
            SELECT id, snapshot_json FROM undo_redo_log
            WHERE project_id = ?1 AND id <= ?2 AND is_keyframe = 1
            ORDER BY id DESC LIMIT 1
            "#,
            params![project_id, target_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;

    let Some((kf_id, kf_json)) = keyframe else {
        return Ok(None);
    };

    let Ok(mut doc) = serde_json::from_str::<serde_json::Value>(&kf_json) else {
        return Ok(None);
    };

    if kf_id == target_id {
        return Ok(Some(doc));
    }

    // 2. 顺序重放 kf_id < id <= target_id 之间的所有增量 Patch
    let mut stmt = tx.prepare(
        r#"
        SELECT patch_json, snapshot_json, is_keyframe FROM undo_redo_log
        WHERE project_id = ?1 AND id > ?2 AND id <= ?3
        ORDER BY id ASC
        "#,
    )?;
    let rows = stmt.query_map(params![project_id, kf_id, target_id], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;

    for row in rows {
        let (patch_json, snap_json, is_kf) = row?;
        if is_kf != 0 && !snap_json.is_empty() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&snap_json) {
                doc = v;
            }
        } else if let Some(pj) = patch_json {
            if let Ok(ops) = serde_json::from_str::<Vec<PatchOp>>(&pj) {
                if let Ok(next_doc) = apply_patch(&doc, &ops) {
                    doc = next_doc;
                }
            }
        }
    }

    Ok(Some(doc))
}

/// 保存 Undo / Redo 操作记录（每 20 步落盘 1 次全量关键帧，中间步仅存 RFC 6902 增量 Patch）
pub fn save_checkpoint(
    conn: &mut Connection,
    project: &Project,
    action_name: &str,
) -> SqlResult<i64> {
    let tx = conn.transaction()?;

    // 剪除被标记为已撤销 (is_undone = 1) 的未来分支
    tx.execute(
        "DELETE FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 1",
        params![project.id],
    )?;

    let current_val = serde_json::to_value(project).unwrap_or(serde_json::Value::Null);
    let now_str = Utc::now().to_rfc3339();

    // 查询当前最新活动记录 ID 与距离上次关键帧的步数
    let latest_id: Option<i64> = tx
        .query_row(
            "SELECT id FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 0 ORDER BY id DESC LIMIT 1",
            params![project.id],
            |row| row.get(0),
        )
        .optional()?;

    let steps_since_kf: usize = tx
        .query_row(
            r#"
            SELECT COUNT(*) FROM undo_redo_log
            WHERE project_id = ?1 AND is_undone = 0
              AND id > COALESCE(
                  (SELECT MAX(id) FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 0 AND is_keyframe = 1),
                  0
              )
            "#,
            params![project.id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0) as usize;

    let should_be_keyframe = latest_id.is_none() || steps_since_kf + 1 >= UNDO_KEYFRAME_INTERVAL;

    let (is_keyframe, snapshot_json, patch_json) = if should_be_keyframe {
        (
            1i64,
            serde_json::to_string(&current_val).unwrap_or_default(),
            None,
        )
    } else if let Some(prev_id) = latest_id {
        if let Some(prev_val) = reconstruct_value_at(&tx, &project.id, prev_id)? {
            let ops = diff_json(&prev_val, &current_val);
            (
                0i64,
                String::new(),
                Some(serde_json::to_string(&ops).unwrap_or_else(|_| "[]".into())),
            )
        } else {
            (
                1i64,
                serde_json::to_string(&current_val).unwrap_or_default(),
                None,
            )
        }
    } else {
        (
            1i64,
            serde_json::to_string(&current_val).unwrap_or_default(),
            None,
        )
    };

    tx.execute(
        r#"
        INSERT INTO undo_redo_log (project_id, action_name, snapshot_json, created_at, is_undone, is_keyframe, patch_json)
        VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
        "#,
        params![
            project.id,
            action_name,
            snapshot_json,
            now_str,
            is_keyframe,
            patch_json
        ],
    )?;

    let insert_id = tx.last_insert_rowid();

    // 限制单项目历史栈深度最多 UNDO_MAX_DEPTH 步，裁切前确保新的最老保留节点升级为关键帧
    let total_count: i64 = tx.query_row(
        "SELECT COUNT(*) FROM undo_redo_log WHERE project_id = ?1",
        params![project.id],
        |row| row.get(0),
    )?;
    if total_count as usize > UNDO_MAX_DEPTH {
        let keep_min_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM undo_redo_log WHERE project_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET ?2",
                params![project.id, (UNDO_MAX_DEPTH - 1) as i64],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(min_keep) = keep_min_id {
            if let Some(rebuilt) = reconstruct_value_at(&tx, &project.id, min_keep)? {
                let rebuilt_json = serde_json::to_string(&rebuilt).unwrap_or_default();
                tx.execute(
                    "UPDATE undo_redo_log SET is_keyframe = 1, snapshot_json = ?1, patch_json = NULL WHERE id = ?2",
                    params![rebuilt_json, min_keep],
                )?;
            }
            tx.execute(
                "DELETE FROM undo_redo_log WHERE project_id = ?1 AND id < ?2",
                params![project.id, min_keep],
            )?;
        }
    }

    tx.commit()?;
    Ok(insert_id)
}

/// 执行 Undo：回退一步操作 (至少保留初始基准快照)
pub fn undo(conn: &mut Connection, project_id: &str) -> SqlResult<Option<Project>> {
    let prev_value = {
        let tx = conn.transaction()?;

        let active_ids: Vec<i64> = {
            let mut stmt = tx.prepare(
                "SELECT id FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 0 ORDER BY id DESC LIMIT 2",
            )?;
            let rows = stmt.query_map(params![project_id], |row| row.get::<_, i64>(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        if active_ids.len() >= 2 {
            let active_id = active_ids[0];
            let target_id = active_ids[1];
            let rebuilt = reconstruct_value_at(&tx, project_id, target_id)?;

            tx.execute(
                "UPDATE undo_redo_log SET is_undone = 1 WHERE id = ?1",
                params![active_id],
            )?;
            tx.commit()?;
            rebuilt
        } else {
            tx.commit()?;
            None
        }
    };

    if let Some(val) = prev_value {
        if let Ok(project) = serde_json::from_value::<Project>(val) {
            let _ = save_project(conn, &project);
            return Ok(Some(project));
        }
    }

    Ok(None)
}

/// 执行 Redo：重做一步操作
pub fn redo(conn: &mut Connection, project_id: &str) -> SqlResult<Option<Project>> {
    let next_value = {
        let tx = conn.transaction()?;

        let next_undone_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 1 ORDER BY id ASC LIMIT 1",
                params![project_id],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(undone_id) = next_undone_id {
            tx.execute(
                "UPDATE undo_redo_log SET is_undone = 0 WHERE id = ?1",
                params![undone_id],
            )?;
            let rebuilt = reconstruct_value_at(&tx, project_id, undone_id)?;
            tx.commit()?;
            rebuilt
        } else {
            tx.commit()?;
            None
        }
    };

    if let Some(val) = next_value {
        if let Ok(project) = serde_json::from_value::<Project>(val) {
            let _ = save_project(conn, &project);
            return Ok(Some(project));
        }
    }

    Ok(None)
}

// ════════════════════════════════════════════════════════════════════════
// Multi-Agent 状态图断点持久化 (agent_checkpoints)
// ════════════════════════════════════════════════════════════════════════

/// 保存一次 Multi-Agent 节点执行断点（支持应用崩溃/关闭后从最近节点无缝恢复）
pub fn save_agent_checkpoint(
    conn: &Connection,
    session_id: &str,
    project_id: &str,
    node_id: &str,
    workflow_profile: &str,
    blackboard_json: &str,
    dag_snapshot_json: &str,
) -> SqlResult<i64> {
    let now_str = Utc::now().to_rfc3339();
    conn.execute(
        r#"
        INSERT INTO agent_checkpoints (
            session_id, project_id, node_id, workflow_profile,
            blackboard_json, dag_snapshot_json, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![
            session_id,
            project_id,
            node_id,
            workflow_profile,
            blackboard_json,
            dag_snapshot_json,
            now_str
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// 读取指定 session 的最新 Agent 断点
pub fn load_latest_agent_checkpoint(
    conn: &Connection,
    session_id: &str,
) -> SqlResult<Option<AgentCheckpointRecord>> {
    conn.query_row(
        r#"
        SELECT id, session_id, project_id, node_id, workflow_profile,
               blackboard_json, dag_snapshot_json, created_at
        FROM agent_checkpoints
        WHERE session_id = ?1
        ORDER BY id DESC LIMIT 1
        "#,
        params![session_id],
        |row| {
            Ok(AgentCheckpointRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                project_id: row.get(2)?,
                node_id: row.get(3)?,
                workflow_profile: row.get(4)?,
                blackboard_json: row.get(5)?,
                dag_snapshot_json: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .optional()
}

/// 读取指定 project 的最新 Agent 断点（用于重新打开项目时恢复上次未完成的工作流）
pub fn load_latest_project_checkpoint(
    conn: &Connection,
    project_id: &str,
) -> SqlResult<Option<AgentCheckpointRecord>> {
    conn.query_row(
        r#"
        SELECT id, session_id, project_id, node_id, workflow_profile,
               blackboard_json, dag_snapshot_json, created_at
        FROM agent_checkpoints
        WHERE project_id = ?1
        ORDER BY id DESC LIMIT 1
        "#,
        params![project_id],
        |row| {
            Ok(AgentCheckpointRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                project_id: row.get(2)?,
                node_id: row.get(3)?,
                workflow_profile: row.get(4)?,
                blackboard_json: row.get(5)?,
                dag_snapshot_json: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .optional()
}

/// 列出指定 session 的全部断点历史
pub fn list_agent_checkpoints(
    conn: &Connection,
    session_id: &str,
) -> SqlResult<Vec<AgentCheckpointRecord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, session_id, project_id, node_id, workflow_profile,
               blackboard_json, dag_snapshot_json, created_at
        FROM agent_checkpoints
        WHERE session_id = ?1
        ORDER BY id ASC
        "#,
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(AgentCheckpointRecord {
            id: row.get(0)?,
            session_id: row.get(1)?,
            project_id: row.get(2)?,
            node_id: row.get(3)?,
            workflow_profile: row.get(4)?,
            blackboard_json: row.get(5)?,
            dag_snapshot_json: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 清理指定 session 的断点记录
pub fn clear_agent_checkpoints(conn: &Connection, session_id: &str) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM agent_checkpoints WHERE session_id = ?1",
        params![session_id],
    )
}

/// 便捷落盘入口：在指定 SQLite 文件路径上自动初始化表结构并写入 Agent 断点（供 Tauri 宿主回调使用）
pub fn save_agent_checkpoint_at_path(
    db_path: &std::path::Path,
    session_id: &str,
    project_id: &str,
    node_id: &str,
    workflow_profile: &str,
    blackboard_json: &str,
    dag_snapshot_json: &str,
) -> SqlResult<i64> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(db_path)?;
    init_database(&conn)?;
    save_agent_checkpoint(
        &conn,
        session_id,
        project_id,
        node_id,
        workflow_profile,
        blackboard_json,
        dag_snapshot_json,
    )
}

// ════════════════════════════════════════════════════════════════════════
// P1-1: 剧集三层内容模型 (Series / Episode / Variant) & Story Bible CRUD
// ════════════════════════════════════════════════════════════════════════

/// 保存或更新剧集空间
pub fn save_series(conn: &Connection, series: &Series) -> SqlResult<()> {
    conn.execute(
        r#"
        INSERT INTO series (id, title, genre, default_style, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            genre = excluded.genre,
            default_style = excluded.default_style,
            updated_at = excluded.updated_at
        "#,
        params![
            series.id,
            series.title,
            series.genre,
            series.default_style,
            series.created_at.to_rfc3339(),
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

/// 列出全部剧集空间（按更新时间倒序）
pub fn list_series(conn: &Connection) -> SqlResult<Vec<Series>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, genre, default_style, created_at, updated_at FROM series ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let created_s: String = row.get(4)?;
        let updated_s: String = row.get(5)?;
        Ok(Series {
            id: row.get(0)?,
            title: row.get(1)?,
            genre: row.get(2)?,
            default_style: row.get(3)?,
            created_at: DateTime::parse_from_rfc3339(&created_s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&updated_s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    })?;
    rows.collect()
}

/// 保存或更新剧集 Story Bible（人物档案 + 滚动前情提要）
pub fn save_story_bible(conn: &Connection, bible: &StoryBible) -> SqlResult<()> {
    let json = serde_json::to_string(bible).unwrap_or_else(|_| "{}".into());
    conn.execute(
        r#"
        INSERT INTO story_bibles (series_id, bible_json, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(series_id) DO UPDATE SET
            bible_json = excluded.bible_json,
            updated_at = excluded.updated_at
        "#,
        params![bible.series_id, json, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

/// 读取剧集 Story Bible
pub fn load_story_bible(conn: &Connection, series_id: &str) -> SqlResult<Option<StoryBible>> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT bible_json FROM story_bibles WHERE series_id = ?1",
            params![series_id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(raw.and_then(|s| serde_json::from_str::<StoryBible>(&s).ok()))
}

/// 保存或更新分集单元
pub fn save_episode(conn: &Connection, ep: &Episode) -> SqlResult<()> {
    let paths_json = serde_json::to_string(&ep.source_paths).unwrap_or_else(|_| "[]".into());
    conn.execute(
        r#"
        INSERT INTO episodes (id, series_id, episode_number, title, source_paths_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            episode_number = excluded.episode_number,
            title = excluded.title,
            source_paths_json = excluded.source_paths_json
        "#,
        params![
            ep.id,
            ep.series_id,
            ep.episode_number as i64,
            ep.title,
            paths_json,
            ep.created_at.to_rfc3339()
        ],
    )?;
    Ok(())
}

/// 列出指定剧集下的全部分集（按集数升序）
pub fn list_episodes(conn: &Connection, series_id: &str) -> SqlResult<Vec<Episode>> {
    let mut stmt = conn.prepare(
        "SELECT id, series_id, episode_number, title, source_paths_json, created_at FROM episodes WHERE series_id = ?1 ORDER BY episode_number ASC",
    )?;
    let rows = stmt.query_map(params![series_id], |row| {
        let paths_s: String = row.get(4)?;
        let created_s: String = row.get(5)?;
        Ok(Episode {
            id: row.get(0)?,
            series_id: row.get(1)?,
            episode_number: row.get::<_, i64>(2)? as u32,
            title: row.get(3)?,
            source_paths: serde_json::from_str(&paths_s).unwrap_or_default(),
            created_at: DateTime::parse_from_rfc3339(&created_s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    })?;
    rows.collect()
}

/// 保存分集下的矩阵变体工程
pub fn save_variant(conn: &Connection, v: &Variant) -> SqlResult<()> {
    let plat_s = v
        .target_platform
        .and_then(|p| serde_json::to_string(&p).ok());
    conn.execute(
        r#"
        INSERT INTO variants (id, episode_id, project_id, label, style_preset, target_platform, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            style_preset = excluded.style_preset,
            target_platform = excluded.target_platform
        "#,
        params![
            v.id,
            v.episode_id,
            v.project_id,
            v.label,
            v.style_preset,
            plat_s,
            v.created_at.to_rfc3339()
        ],
    )?;
    Ok(())
}

/// 列出指定分集下的全部矩阵变体
pub fn list_variants(conn: &Connection, episode_id: &str) -> SqlResult<Vec<Variant>> {
    let mut stmt = conn.prepare(
        "SELECT id, episode_id, project_id, label, style_preset, target_platform, created_at FROM variants WHERE episode_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![episode_id], |row| {
        let plat_s: Option<String> = row.get(5)?;
        let created_s: String = row.get(6)?;
        Ok(Variant {
            id: row.get(0)?,
            episode_id: row.get(1)?,
            project_id: row.get(2)?,
            label: row.get(3)?,
            style_preset: row.get(4)?,
            target_platform: plat_s.and_then(|s| serde_json::from_str::<PlatformId>(&s).ok()),
            created_at: DateTime::parse_from_rfc3339(&created_s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    })?;
    rows.collect()
}

// ── Batch Jobs 持久化任务队列 (P2-1) ───────────────────────────────────

/// 保存或更新后台批处理任务实体 (P2-1)
pub fn save_batch_job(conn: &Connection, job: &BatchJob) -> SqlResult<()> {
    let job_type_s =
        serde_json::to_string(&job.job_type).unwrap_or_else(|_| "\"asr_transcribe\"".into());
    let status_s = job.status.to_string();
    conn.execute(
        r#"
        INSERT INTO batch_jobs (id, job_type, status, payload_json, result_json, error_message, progress, retry_count, max_retries, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            result_json = excluded.result_json,
            error_message = excluded.error_message,
            progress = excluded.progress,
            retry_count = excluded.retry_count,
            max_retries = excluded.max_retries,
            updated_at = excluded.updated_at
        "#,
        params![
            job.id,
            job_type_s.trim_matches('"'),
            status_s,
            job.payload_json,
            job.result_json,
            job.error_message,
            job.progress,
            job.retry_count,
            job.max_retries,
            job.created_at.to_rfc3339(),
            job.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

/// 查询单个后台任务
pub fn get_batch_job(conn: &Connection, id: &str) -> SqlResult<Option<BatchJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, job_type, status, payload_json, result_json, error_message, progress, retry_count, max_retries, created_at, updated_at FROM batch_jobs WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], parse_batch_job_row)?;
    if let Some(r) = rows.next() {
        Ok(Some(r?))
    } else {
        Ok(None)
    }
}

/// 列出批处理任务 (可按状态过滤)
pub fn list_batch_jobs(
    conn: &Connection,
    status: Option<&str>,
    limit: usize,
) -> SqlResult<Vec<BatchJob>> {
    if let Some(st) = status {
        let mut stmt = conn.prepare(
            "SELECT id, job_type, status, payload_json, result_json, error_message, progress, retry_count, max_retries, created_at, updated_at FROM batch_jobs WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![st, limit as i64], parse_batch_job_row)?;
        rows.collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, job_type, status, payload_json, result_json, error_message, progress, retry_count, max_retries, created_at, updated_at FROM batch_jobs ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], parse_batch_job_row)?;
        rows.collect()
    }
}

/// 从队列中抓取下一个待执行的任务 (原子更新为 running)
pub fn fetch_next_pending_job(conn: &Connection) -> SqlResult<Option<BatchJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, job_type, status, payload_json, result_json, error_message, progress, retry_count, max_retries, created_at, updated_at FROM batch_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1",
    )?;
    let mut rows = stmt.query_map([], parse_batch_job_row)?;
    if let Some(r) = rows.next() {
        let mut job = r?;
        job.status = BatchJobStatus::Running;
        job.updated_at = Utc::now();
        conn.execute(
            "UPDATE batch_jobs SET status = 'running', updated_at = ?1 WHERE id = ?2 AND status = 'pending'",
            params![job.updated_at.to_rfc3339(), job.id],
        )?;
        Ok(Some(job))
    } else {
        Ok(None)
    }
}

/// 更新任务进度与当前阶段
pub fn update_batch_job_progress(conn: &Connection, id: &str, progress: f32) -> SqlResult<()> {
    conn.execute(
        "UPDATE batch_jobs SET progress = ?1, updated_at = ?2 WHERE id = ?3",
        params![progress, Utc::now().to_rfc3339(), id],
    )?;
    Ok(())
}

/// 标记任务完成
pub fn complete_batch_job(conn: &Connection, id: &str, result_json: &str) -> SqlResult<()> {
    conn.execute(
        "UPDATE batch_jobs SET status = 'completed', progress = 100.0, result_json = ?1, updated_at = ?2 WHERE id = ?3",
        params![result_json, Utc::now().to_rfc3339(), id],
    )?;
    Ok(())
}

/// 标记任务失败 (支持自动增加重试计数或进入重试等待)
pub fn fail_batch_job(conn: &Connection, id: &str, error: &str) -> SqlResult<()> {
    let job = get_batch_job(conn, id)?;
    if let Some(j) = job {
        let next_retry = j.retry_count + 1;
        let next_status = if next_retry < j.max_retries {
            "pending" // 自动重新排队
        } else {
            "failed"
        };
        conn.execute(
            "UPDATE batch_jobs SET status = ?1, error_message = ?2, retry_count = ?3, updated_at = ?4 WHERE id = ?5",
            params![next_status, error, next_retry, Utc::now().to_rfc3339(), id],
        )?;
    }
    Ok(())
}

/// 取消指定任务
pub fn cancel_batch_job(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute(
        "UPDATE batch_jobs SET status = 'cancelled', updated_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id],
    )?;
    Ok(())
}

fn parse_batch_job_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BatchJob> {
    let type_str: String = row.get(1)?;
    let status_str: String = row.get(2)?;
    let created_s: String = row.get(9)?;
    let updated_s: String = row.get(10)?;

    let job_type = match type_str.as_str() {
        "scene_analysis" => BatchJobType::SceneAnalysis,
        "script_generation" => BatchJobType::ScriptGeneration,
        "voice_synthesis" => BatchJobType::VoiceSynthesis,
        "master_render" => BatchJobType::MasterRender,
        "full_fission" => BatchJobType::FullFission,
        _ => BatchJobType::AsrTranscribe,
    };

    let status = match status_str.as_str() {
        "running" => BatchJobStatus::Running,
        "completed" => BatchJobStatus::Completed,
        "failed" => BatchJobStatus::Failed,
        "cancelled" => BatchJobStatus::Cancelled,
        _ => BatchJobStatus::Pending,
    };

    Ok(BatchJob {
        id: row.get(0)?,
        job_type,
        status,
        payload_json: row.get(3)?,
        result_json: row.get(4)?,
        error_message: row.get(5)?,
        progress: row.get(6)?,
        retry_count: row.get(7)?,
        max_retries: row.get(8)?,
        created_at: DateTime::parse_from_rfc3339(&created_s)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_s)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

// ── 跨集与全文检索引擎 (P2-2) ──────────────────────────────────────────

/// 跨集台词与分段搜索命中条目 (P2-2)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSegmentHit {
    pub segment_id: String,
    pub project_id: String,
    pub text: String,
    pub emotion: Option<String>,
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
    pub is_hook: bool,
}

/// 跨工程/跨集台词与剧本文本极速检索 (优先 FTS 模式，自动优雅回退)
pub fn search_script_segments_fts(
    conn: &Connection,
    query: &str,
    project_id: Option<&str>,
    limit: usize,
) -> SqlResult<Vec<ScriptSegmentHit>> {
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }

    let pattern = format!("%{}%", clean_query);

    let mut stmt = if let Some(_pid) = project_id {
        conn.prepare(
            r#"
            SELECT id, project_id, text, emotion, start_seconds, end_seconds, is_hook
            FROM script_segments
            WHERE project_id = ?1 AND text LIKE ?2
            ORDER BY segment_order ASC
            LIMIT ?3
            "#,
        )?
    } else {
        conn.prepare(
            r#"
            SELECT id, project_id, text, emotion, start_seconds, end_seconds, is_hook
            FROM script_segments
            WHERE text LIKE ?1
            ORDER BY project_id, segment_order ASC
            LIMIT ?2
            "#,
        )?
    };

    let rows = if let Some(pid) = project_id {
        stmt.query_map(params![pid, pattern, limit as i64], parse_segment_hit_row)?
    } else {
        stmt.query_map(params![pattern, limit as i64], parse_segment_hit_row)?
    };

    rows.collect()
}

fn parse_segment_hit_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScriptSegmentHit> {
    let is_hook_int: Option<i64> = row.get(6)?;
    Ok(ScriptSegmentHit {
        segment_id: row.get(0)?,
        project_id: row.get(1)?,
        text: row.get(2)?,
        emotion: row.get(3)?,
        start_seconds: row.get(4)?,
        end_seconds: row.get(5)?,
        is_hook: is_hook_int.unwrap_or(0) == 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use dramaxis_core::domain::PlatformId;

    #[test]
    fn test_sqlite_schema_init_and_crud() {
        let mut conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db schema");

        let mut project = Project {
            id: "proj-test-101".into(),
            name: "爆款电影解说测试".into(),
            settings: dramaxis_core::domain::ProjectSettings {
                resolution: "1080x1920".into(),
                target_platform: Some(PlatformId::Douyin),
                ..Default::default()
            },
            ..Default::default()
        };

        project.media_files.push(MediaFile {
            path: PathBuf::from("/tmp/video1.mp4"),
            duration_seconds: 120.5,
            resolution: Some("1920x1080".into()),
            codec: Some("h264".into()),
            file_size_bytes: 10485760,
            import_time: Utc::now(),
        });

        project.scripts.push(ScriptSegment {
            id: "seg-1".into(),
            step_index: 1,
            text: "注意看，这个男人叫小帅，此刻正被神秘人围堵在小巷中。".into(),
            emotion: Some("紧张".into()),
            start_seconds: Some(0.0),
            end_seconds: Some(3.5),
            is_hook: Some(true),
            hook_style: Some("黄金3秒悬念".into()),
            visual_cut_ref: Some("cut-01".into()),
            score: Some(92.5),
            ..Default::default()
        });

        project.timeline = Timeline::default_5tracks();
        project.timeline.tracks[0].clips.push(Clip {
            id: "clip-1".into(),
            media_ref: PathBuf::from("/tmp/video1.mp4"),
            start_seconds: 0.0,
            in_seconds: 10.0,
            out_seconds: 13.5,
            volume: Some(1.0),
        });

        // 1. 保存测试
        save_project(&mut conn, &project).expect("save project");

        // 2. 读取测试
        let loaded = load_project(&conn, Some("proj-test-101"))
            .expect("load project")
            .expect("should exist");

        assert_eq!(loaded.id, "proj-test-101");
        assert_eq!(loaded.name, "爆款电影解说测试");
        assert_eq!(loaded.settings.target_platform, Some(PlatformId::Douyin));
        assert_eq!(loaded.media_files.len(), 1);
        assert_eq!(loaded.scripts.len(), 1);
        assert_eq!(
            loaded.scripts[0].text,
            "注意看，这个男人叫小帅，此刻正被神秘人围堵在小巷中。"
        );
        assert_eq!(loaded.scripts[0].is_hook, Some(true));
        assert_eq!(loaded.timeline.tracks.len(), 5);
        assert_eq!(loaded.timeline.tracks[0].clips.len(), 1);

        // 3. Undo / Redo 测试
        save_checkpoint(&mut conn, &project, "初始创建").expect("save checkpoint 1");

        // 修改台词
        let mut modified = project.clone();
        modified.scripts[0].text =
            "谁也没想到，这个看似平凡的普通人，竟然隐藏着足以改变战局的秘密。".into();
        save_project(&mut conn, &modified).expect("save modified");
        save_checkpoint(&mut conn, &modified, "修改第一句台词").expect("save checkpoint 2");

        // 执行 Undo
        let undone = undo(&mut conn, "proj-test-101")
            .expect("undo")
            .expect("undone project");
        assert_eq!(
            undone.scripts[0].text,
            "注意看，这个男人叫小帅，此刻正被神秘人围堵在小巷中。"
        );

        // 执行 Redo
        let redone = redo(&mut conn, "proj-test-101")
            .expect("redo")
            .expect("redone project");
        assert_eq!(
            redone.scripts[0].text,
            "谁也没想到，这个看似平凡的普通人，竟然隐藏着足以改变战局的秘密。"
        );
    }

    #[test]
    fn test_incremental_patch_undo_across_keyframes_and_size_savings() {
        let mut conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db schema");

        let mut project = Project {
            id: "proj-patch-test".into(),
            name: "长篇短剧增量撤销测试".into(),
            ..Default::default()
        };
        for i in 0..30 {
            project.scripts.push(ScriptSegment {
                id: format!("seg-{i}"),
                step_index: 2,
                text: format!("第 {i} 段影视解说初始文案内容，包含足够多的文本用于验证增量差分体积。"),
                ..Default::default()
            });
        }
        save_project(&mut conn, &project).expect("save initial");
        save_checkpoint(&mut conn, &project, "基准快照").expect("ckpt 0");

        let full_size = serde_json::to_string(&project).unwrap().len();

        // 连续做 24 次小改（跨越 UNDO_KEYFRAME_INTERVAL = 20）
        for step in 1..=24 {
            project.scripts[0].text = format!("第 0 段经过第 {step} 次精修");
            save_checkpoint(&mut conn, &project, &format!("精修 #{step}")).expect("ckpt");
        }

        // 验证中间步使用了增量 Patch（is_keyframe = 0）且体积远小于全量快照
        let (patch_rows, avg_patch_len): (i64, f64) = conn
            .query_row(
                "SELECT COUNT(*), AVG(LENGTH(patch_json)) FROM undo_redo_log WHERE project_id = ?1 AND is_keyframe = 0",
                params![project.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query patch stats");
        assert!(patch_rows >= 20, "应至少有 20 条增量 Patch 记录");
        assert!(
            (avg_patch_len as usize) * 5 < full_size,
            "增量 Patch 体积应显著小于全量快照: avg={avg_patch_len}, full={full_size}"
        );

        // 连续 Undo 6 次，验证精准回退到 step 18（跨越第 20 步关键帧）
        let mut last = None;
        for _ in 0..6 {
            last = undo(&mut conn, "proj-patch-test").expect("undo");
        }
        assert_eq!(last.unwrap().scripts[0].text, "第 0 段经过第 18 次精修");

        // 连续 Redo 3 次，验证精准前进到 step 21
        let mut redone = None;
        for _ in 0..3 {
            redone = redo(&mut conn, "proj-patch-test").expect("redo");
        }
        assert_eq!(redone.unwrap().scripts[0].text, "第 0 段经过第 21 次精修");
    }

    #[test]
    fn test_agent_checkpoints_persistence_and_recovery() {
        let conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db schema");

        let id1 = save_agent_checkpoint(
            &conn,
            "sess-001",
            "proj-001",
            "visual_analysis",
            "standard_drama",
            r#"{"visualBrief":{"totalDurationSec":60.0}}"#,
            r#"{"completedNodes":2}"#,
        )
        .expect("save ckpt 1");
        let id2 = save_agent_checkpoint(
            &conn,
            "sess-001",
            "proj-001",
            "hitl_approval",
            "standard_drama",
            r#"{"visualBrief":{"totalDurationSec":60.0},"scriptVersions":[{"version":1}]}"#,
            r#"{"completedNodes":5}"#,
        )
        .expect("save ckpt 2");
        assert!(id2 > id1);

        let latest = load_latest_agent_checkpoint(&conn, "sess-001")
            .expect("load latest")
            .expect("should exist");
        assert_eq!(latest.node_id, "hitl_approval");
        assert_eq!(latest.project_id, "proj-001");

        let by_proj = load_latest_project_checkpoint(&conn, "proj-001")
            .expect("load by project")
            .expect("should exist");
        assert_eq!(by_proj.session_id, "sess-001");

        let all = list_agent_checkpoints(&conn, "sess-001").expect("list");
        assert_eq!(all.len(), 2);

        let deleted = clear_agent_checkpoints(&conn, "sess-001").expect("clear");
        assert_eq!(deleted, 2);
        assert!(load_latest_agent_checkpoint(&conn, "sess-001")
            .expect("after clear")
            .is_none());
    }

    #[test]
    fn test_series_episode_variant_and_story_bible_crud() {
        use dramaxis_core::domain::{CharacterProfile, EpisodeRecap};

        let conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db schema");

        let series = Series {
            id: "ser-001".into(),
            title: "龙王归来80集微短剧".into(),
            genre: "都市逆袭".into(),
            default_style: "悬疑强反转".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        save_series(&conn, &series).expect("save series");
        assert_eq!(list_series(&conn).unwrap().len(), 1);

        let bible = StoryBible {
            series_id: "ser-001".into(),
            worldview: "现代商战豪门".into(),
            core_conflict: "隐忍三年的上门女婿真实身份是千亿财团继承人".into(),
            narrator_persona: "第一人称爽文解说".into(),
            characters: vec![CharacterProfile {
                id: "ch-1".into(),
                name: "林峰".into(),
                alias: Some("龙王男主".into()),
                role_type: "主角".into(),
                traits: "隐忍霸气".into(),
                relationships: "苏婉晴丈夫".into(),
            }],
            rolling_recaps: vec![EpisodeRecap {
                episode_number: 1,
                summary: "寿宴上遭岳母当众羞辱并逼签离婚协议".into(),
                unresolved_hook: Some("神秘黑衣管家突然闯入下跪".into()),
            }],
        };
        save_story_bible(&conn, &bible).expect("save bible");
        let loaded_bible = load_story_bible(&conn, "ser-001").unwrap().unwrap();
        assert_eq!(loaded_bible.characters[0].name, "林峰");
        assert!(loaded_bible.to_prompt_context().contains("神秘黑衣管家"));

        let ep = Episode {
            id: "ep-001".into(),
            series_id: "ser-001".into(),
            episode_number: 1,
            title: "第1-3集 寿宴羞辱".into(),
            source_paths: vec![PathBuf::from("/nas/ep01.mp4")],
            created_at: Utc::now(),
        };
        save_episode(&conn, &ep).expect("save episode");
        assert_eq!(list_episodes(&conn, "ser-001").unwrap().len(), 1);

        let var = Variant {
            id: "var-dy".into(),
            episode_id: "ep-001".into(),
            project_id: "proj-dy-01".into(),
            label: "抖音悬疑Hook版".into(),
            style_preset: "suspense".into(),
            target_platform: Some(PlatformId::Douyin),
            created_at: Utc::now(),
        };
        save_variant(&conn, &var).expect("save variant");
        let vars = list_variants(&conn, "ep-001").unwrap();
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].target_platform, Some(PlatformId::Douyin));
    }

    #[test]
    fn test_batch_jobs_queue_lifecycle() {
        let conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db");

        let job = BatchJob {
            id: "job-001".into(),
            job_type: BatchJobType::FullFission,
            status: BatchJobStatus::Pending,
            payload_json: r#"{"count": 5}"#.into(),
            result_json: None,
            error_message: None,
            progress: 0.0,
            retry_count: 0,
            max_retries: 2,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        save_batch_job(&conn, &job).expect("save job");
        let list = list_batch_jobs(&conn, Some("pending"), 10).expect("list jobs");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "job-001");

        // 队列原子消费
        let next = fetch_next_pending_job(&conn).expect("fetch next").expect("job");
        assert_eq!(next.id, "job-001");
        assert_eq!(next.status, BatchJobStatus::Running);

        // 再次抓取为空
        assert!(fetch_next_pending_job(&conn).expect("fetch empty").is_none());

        // 进度更新
        update_batch_job_progress(&conn, "job-001", 50.0).expect("progress");
        let fetched = get_batch_job(&conn, "job-001").expect("get").unwrap();
        assert_eq!(fetched.progress, 50.0);

        // 任务完成
        complete_batch_job(&conn, "job-001", r#"{"done": true}"#).expect("complete");
        let done_job = get_batch_job(&conn, "job-001").expect("get").unwrap();
        assert_eq!(done_job.status, BatchJobStatus::Completed);
        assert_eq!(done_job.progress, 100.0);
    }

    #[test]
    fn test_search_script_segments_fts() {
        let mut conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db");

        let mut proj = Project {
            id: "proj-fts-01".into(),
            name: "全城首富测试".into(),
            ..Default::default()
        };
        proj.scripts.push(ScriptSegment {
            id: "seg-10".into(),
            step_index: 1,
            text: "三年之期已到，恭迎龙王回归！".into(),
            emotion: Some("震撼".into()),
            start_seconds: Some(0.0),
            end_seconds: Some(3.5),
            is_hook: Some(true),
            hook_style: Some("黄金三秒".into()),
            ..Default::default()
        });
        save_project(&mut conn, &proj).expect("save proj");

        let hits = search_script_segments_fts(&conn, "龙王", None, 10).expect("search");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].segment_id, "seg-10");
        assert!(hits[0].is_hook);

        let empty = search_script_segments_fts(&conn, "外星人", None, 10).expect("search");
        assert!(empty.is_empty());
    }
}
