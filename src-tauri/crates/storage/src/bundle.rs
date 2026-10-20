//! dramaxis-storage::bundle · .dramaxis 工程包容器管理器
//!
//! ## 容器目录结构
//! ```text
//! MyProject.dramaxis/
//! ├── project.db          (SQLite WAL 数据库，承载元数据与时间轴)
//! ├── thumbnails/         (素材缩略图缓存)
//! ├── audio_cache/        (TTS 旁白切片与波形缓存)
//! └── export/             (导出的剪映草稿包 .draft 与视频成片)
//! ```
//!
//! ## 容灾与迁移
//! - 自动支持从旧版 .json / .splicr 遗留工程无缝原地迁移到 .dramaxis 包
//! - 写入采用 WAL 事务机制，杜绝断电导致文件损坏

use crate::db::{init_database, load_project, redo, save_checkpoint, save_project, undo};
use crate::AssetError;
use dramaxis_core::domain::Project;
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

pub type BundleResult<T> = Result<T, AssetError>;

/// .dramaxis 规范工程包句柄
#[derive(Debug, Clone)]
pub struct DramaxisBundle {
    pub path: PathBuf,
}

impl DramaxisBundle {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        let p = path.into();
        Self { path: p }
    }

    pub fn db_path(&self) -> PathBuf {
        self.path.join("project.db")
    }

    pub fn thumbnails_dir(&self) -> PathBuf {
        self.path.join("thumbnails")
    }

    pub fn audio_cache_dir(&self) -> PathBuf {
        self.path.join("audio_cache")
    }

    pub fn export_dir(&self) -> PathBuf {
        self.path.join("export")
    }

    /// 获取 SQLite 数据库连接并确保初始化
    pub fn connect(&self) -> BundleResult<Connection> {
        let db_file = self.db_path();
        let conn = Connection::open(&db_file)
            .map_err(|e| AssetError::NotFound(format!("SQLite 打开失败: {}", e)))?;
        init_database(&conn)
            .map_err(|e| AssetError::ProbeParse(format!("Schema 初始化失败: {}", e)))?;
        Ok(conn)
    }
}

/// 规范化工程包路径（若无扩展名则自动补齐 .dramaxis）
pub fn normalize_bundle_path(path: &Path) -> PathBuf {
    if path.extension().and_then(|s| s.to_str()) == Some("dramaxis") {
        path.to_path_buf()
    } else {
        path.with_extension("dramaxis")
    }
}

/// 创建全新的 .dramaxis 工程包
pub fn create_bundle(path: &Path, project: &Project) -> BundleResult<DramaxisBundle> {
    let bundle_path = normalize_bundle_path(path);

    // 1. 创建工程包目录结构
    fs::create_dir_all(&bundle_path)?;
    let bundle = DramaxisBundle::new(&bundle_path);
    fs::create_dir_all(bundle.thumbnails_dir())?;
    fs::create_dir_all(bundle.audio_cache_dir())?;
    fs::create_dir_all(bundle.export_dir())?;

    // 2. 初始化数据库并保存初始状态与首个 Checkpoint
    let mut conn = bundle.connect()?;
    save_project(&mut conn, project)
        .map_err(|e| AssetError::ProbeParse(format!("保存项目失败: {}", e)))?;
    let _ = save_checkpoint(&mut conn, project, "工程初始化");

    tracing::info!(bundle = %bundle_path.display(), id = %project.id, "创建 .dramaxis 工程包成功");
    Ok(bundle)
}

/// 打开 .dramaxis 工程包（自动识别并兼容旧版 .json / .splicr 格式并自动迁移）
pub fn open_bundle(path: &Path) -> BundleResult<(DramaxisBundle, Project)> {
    if !path.exists() {
        return Err(AssetError::NotFound(format!(
            "工程路径不存在: {}",
            path.display()
        )));
    }

    // 兼容：若传入的是旧版单文件 JSON，则自动原地升级为 .dramaxis 工程包
    if path.is_file() {
        let is_json_or_splicr = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext == "json" || ext == "splicr")
            .unwrap_or(false);

        if is_json_or_splicr {
            tracing::info!(legacy_file = %path.display(), "检测到遗留工程文件，开始自动迁移到 .dramaxis 包...");
            return migrate_legacy_file(path);
        }
    }

    // 标准工程包目录
    let bundle = DramaxisBundle::new(path);
    if !bundle.db_path().exists() {
        return Err(AssetError::NotFound(format!(
            "工程包缺少核心 project.db: {}",
            path.display()
        )));
    }

    let conn = bundle.connect()?;
    let project = load_project(&conn, None)
        .map_err(|e| AssetError::ProbeParse(format!("加载工程数据失败: {}", e)))?
        .ok_or_else(|| AssetError::NotFound("数据库中未找到任何有效项目记录".into()))?;

    Ok((bundle, project))
}

/// 保存当前状态到工程包
pub fn save_bundle(
    bundle_path: &Path,
    project: &Project,
    checkpoint_name: Option<&str>,
) -> BundleResult<()> {
    let bundle = DramaxisBundle::new(bundle_path);
    let mut conn = bundle.connect()?;

    save_project(&mut conn, project)
        .map_err(|e| AssetError::ProbeParse(format!("保存项目失败: {}", e)))?;

    if let Some(action) = checkpoint_name {
        let _ = save_checkpoint(&mut conn, project, action);
    }

    Ok(())
}

/// 执行工程包内的撤销操作 (Undo)
pub fn undo_bundle(bundle_path: &Path, project_id: &str) -> BundleResult<Option<Project>> {
    let bundle = DramaxisBundle::new(bundle_path);
    let mut conn = bundle.connect()?;

    let res = undo(&mut conn, project_id)
        .map_err(|e| AssetError::ProbeParse(format!("撤销失败: {}", e)))?;
    Ok(res)
}

/// 执行工程包内的重做操作 (Redo)
pub fn redo_bundle(bundle_path: &Path, project_id: &str) -> BundleResult<Option<Project>> {
    let bundle = DramaxisBundle::new(bundle_path);
    let mut conn = bundle.connect()?;

    let res = redo(&mut conn, project_id)
        .map_err(|e| AssetError::ProbeParse(format!("重做失败: {}", e)))?;
    Ok(res)
}

/// 从旧版 JSON / .splicr 文件自动无损迁移到 .dramaxis 工程包
pub fn migrate_legacy_file(legacy_path: &Path) -> BundleResult<(DramaxisBundle, Project)> {
    let content = fs::read_to_string(legacy_path)?;
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| AssetError::ProbeParse(format!("遗留工程 JSON 反序列化失败: {}", e)))?;

    let target_bundle_path = legacy_path.with_extension("dramaxis");
    let bundle = create_bundle(&target_bundle_path, &project)?;

    tracing::info!(
        from = %legacy_path.display(),
        to = %target_bundle_path.display(),
        "遗留工程成功迁移至 .dramaxis 规范包"
    );

    Ok((bundle, project))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bundle_lifecycle_and_legacy_migration() {
        let temp_base = std::env::temp_dir().join(format!(
            "dramaxis-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_base).expect("create temp dir");
        let bundle_target = temp_base.join("DemoMovie.dramaxis");

        let project = Project {
            id: "proj-bundle-test".into(),
            name: "工程包容器生命周期测试".into(),
            ..Default::default()
        };

        // 1. 创建工程包
        let bundle = create_bundle(&bundle_target, &project).expect("create bundle");
        assert!(bundle.db_path().exists());
        assert!(bundle.thumbnails_dir().exists());
        assert!(bundle.audio_cache_dir().exists());
        assert!(bundle.export_dir().exists());

        // 2. 打开工程包
        let (opened_bundle, opened_proj) = open_bundle(&bundle_target).expect("open bundle");
        assert_eq!(opened_proj.id, "proj-bundle-test");
        assert_eq!(opened_bundle.path, bundle_target);

        // 3. 保存更新与 Checkpoint
        let mut updated_proj = opened_proj.clone();
        updated_proj.name = "修改后的工程名".into();
        save_bundle(&bundle_target, &updated_proj, Some("重命名工程")).expect("save bundle");

        let (_, reloaded_proj) = open_bundle(&bundle_target).expect("reload");
        assert_eq!(reloaded_proj.name, "修改后的工程名");

        // 4. 测试撤销
        let undone = undo_bundle(&bundle_target, "proj-bundle-test")
            .expect("undo")
            .expect("undone project");
        assert_eq!(undone.name, "工程包容器生命周期测试");

        // 5. 遗留 JSON 自动迁移测试
        let legacy_file = temp_base.join("OldProject.json");
        let json_str = serde_json::to_string(&project).unwrap();
        fs::write(&legacy_file, json_str).expect("write legacy json");

        let (migrated_bundle, migrated_proj) =
            open_bundle(&legacy_file).expect("auto migrate legacy file");
        assert_eq!(migrated_proj.id, "proj-bundle-test");
        assert!(migrated_bundle.db_path().exists());
        assert!(migrated_bundle.path.ends_with("OldProject.dramaxis"));
    }
}
