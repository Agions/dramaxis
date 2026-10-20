//! dramaxis-storage::db · 嵌入式 SQLite 核心数据持久化与 Undo/Redo 引擎
//!
//! ## 设计原则
//! - 采用 SQLite WAL 模式与 FOREIGN KEY 级联，保证 100% ACID 崩溃安全性
//! - 时间轴片段与剧本分段支持增量顺序存取
//! - 提供操作快照历史栈，支持秒级 Undo / Redo

use chrono::{DateTime, Utc};
use dramaxis_core::domain::{
    Clip, ExportRecord, ExportStrategy, MediaFile, Project, ProjectSettings, ScriptSegment,
    Timeline, Track, TrackKind,
};
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;

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
            is_undone INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_media_project ON media_assets(project_id);
        CREATE INDEX IF NOT EXISTS idx_tracks_project ON timeline_tracks(project_id, track_order);
        CREATE INDEX IF NOT EXISTS idx_clips_track ON timeline_clips(track_id, clip_order);
        CREATE INDEX IF NOT EXISTS idx_scripts_project ON script_segments(project_id, segment_order);
        CREATE INDEX IF NOT EXISTS idx_undo_project ON undo_redo_log(project_id, id);
        "#,
    )?;

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

/// 保存 Undo / Redo 操作快照
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

    let snapshot_json = serde_json::to_string(project).unwrap_or_default();
    let now_str = Utc::now().to_rfc3339();

    tx.execute(
        r#"
        INSERT INTO undo_redo_log (project_id, action_name, snapshot_json, created_at, is_undone)
        VALUES (?1, ?2, ?3, ?4, 0)
        "#,
        params![project.id, action_name, snapshot_json, now_str],
    )?;

    let insert_id = tx.last_insert_rowid();

    // 限制单项目历史栈深度最多 50 步
    tx.execute(
        r#"
        DELETE FROM undo_redo_log
        WHERE project_id = ?1 AND id NOT IN (
            SELECT id FROM undo_redo_log WHERE project_id = ?1 ORDER BY id DESC LIMIT 50
        )
        "#,
        params![project.id],
    )?;

    tx.commit()?;
    Ok(insert_id)
}

/// 执行 Undo：回退一步操作
pub fn undo(conn: &mut Connection, project_id: &str) -> SqlResult<Option<Project>> {
    let prev_snapshot = {
        let tx = conn.transaction()?;

        // 找到最近的一个未撤销快照并将其标记为已撤销
        let latest_active_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 0 ORDER BY id DESC LIMIT 1",
                params![project_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(active_id) = latest_active_id {
            tx.execute(
                "UPDATE undo_redo_log SET is_undone = 1 WHERE id = ?1",
                params![active_id],
            )?;

            // 查找上一个快照
            let snapshot: Option<String> = tx
                .query_row(
                    "SELECT snapshot_json FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 0 ORDER BY id DESC LIMIT 1",
                    params![project_id],
                    |row| row.get(0),
                )
                .ok();

            tx.commit()?;
            snapshot
        } else {
            tx.commit()?;
            None
        }
    };

    if let Some(json) = prev_snapshot {
        if let Ok(project) = serde_json::from_str::<Project>(&json) {
            let _ = save_project(conn, &project);
            return Ok(Some(project));
        }
    }

    Ok(None)
}

/// 执行 Redo：重做一步操作
pub fn redo(conn: &mut Connection, project_id: &str) -> SqlResult<Option<Project>> {
    let next_snapshot = {
        let tx = conn.transaction()?;

        // 找到最早的一个已撤销快照 (最接近当前时间线的那步)
        let next_undone: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, snapshot_json FROM undo_redo_log WHERE project_id = ?1 AND is_undone = 1 ORDER BY id ASC LIMIT 1",
                params![project_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((undone_id, snapshot_json)) = next_undone {
            tx.execute(
                "UPDATE undo_redo_log SET is_undone = 0 WHERE id = ?1",
                params![undone_id],
            )?;
            tx.commit()?;
            Some(snapshot_json)
        } else {
            tx.commit()?;
            None
        }
    };

    if let Some(snapshot_json) = next_snapshot {
        if let Ok(project) = serde_json::from_str::<Project>(&snapshot_json) {
            let _ = save_project(conn, &project);
            return Ok(Some(project));
        }
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use dramaxis_core::domain::PlatformId;

    #[test]
    fn test_sqlite_schema_init_and_crud() {
        let mut conn = Connection::open_in_memory().expect("open memory db");
        init_database(&conn).expect("init db schema");

        let mut project = Project::default();
        project.id = "proj-test-101".into();
        project.name = "爆款电影解说测试".into();
        project.settings.resolution = "1080x1920".into();
        project.settings.target_platform = Some(PlatformId::Douyin);

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
}
