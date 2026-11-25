//! dramaxis-storage::remap · 工作室 NAS 跨平台路径重映射与素材重定位引擎
//!
//! ## 核心定位 (P2-2)
//! 解决工作室团队多机协同共享 `.dramaxis` 工程包时，因操作系统挂载点不同
//! （macOS `/Volumes/Share/...`、Windows `Z:\Share\...`、Linux `/mnt/share/...`）
//! 导致的素材脱机红屏问题。

use dramaxis_core::domain::Project;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 路径映射单条前缀规则
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PathMappingRule {
    pub from_prefix: PathBuf,
    pub to_prefix: PathBuf,
}

/// 工作室 NAS 跨平台路径重映射器
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NasPathRemapper {
    pub rules: Vec<PathMappingRule>,
}

impl NasPathRemapper {
    pub fn new() -> Self {
        Self::default()
    }

    /// 添加一条路径重映射规则
    pub fn add_rule(&mut self, from: impl Into<PathBuf>, to: impl Into<PathBuf>) {
        self.rules.push(PathMappingRule {
            from_prefix: from.into(),
            to_prefix: to.into(),
        });
    }

    /// 将原路径按规则重映射为当前机器上的目标路径
    pub fn remap_path(&self, original: &Path) -> PathBuf {
        let original_str = original.to_string_lossy();

        for rule in &self.rules {
            let from_str = rule.from_prefix.to_string_lossy();
            if original_str.starts_with(from_str.as_ref()) {
                let suffix = &original_str[from_str.len()..];
                let clean_suffix = suffix.trim_start_matches(['/', '\\']);
                return rule.to_prefix.join(clean_suffix);
            }
        }

        original.to_path_buf()
    }

    /// 启发式智能重定位：若原路径在当前机器不存在，尝试在候选目录池中按文件名与相对路径寻找
    pub fn auto_locate(&self, original: &Path, candidate_roots: &[PathBuf]) -> Option<PathBuf> {
        if original.exists() {
            return Some(original.to_path_buf());
        }

        // 1. 尝试先规则重映射
        let mapped = self.remap_path(original);
        if mapped.exists() {
            return Some(mapped);
        }

        // 2. 尝试从原路径中提取最后两层（如 `Ep01/video.mp4`）或单纯文件名
        let file_name = original.file_name()?;
        for root in candidate_roots {
            // 候选 1: root/file_name
            let candidate1 = root.join(file_name);
            if candidate1.exists() {
                return Some(candidate1);
            }

            // 候选 2: root/parent_dir/file_name
            if let Some(parent) = original.parent().and_then(|p| p.file_name()) {
                let candidate2 = root.join(parent).join(file_name);
                if candidate2.exists() {
                    return Some(candidate2);
                }
            }
        }

        None
    }

    /// 对整份 Project 中的所有 media_files 及 timeline clips 进行原地路径重映射
    pub fn remap_project(&self, project: &mut Project, candidate_roots: &[PathBuf]) -> usize {
        let mut remapped_count = 0;

        for media in &mut project.media_files {
            if let Some(located) = self.auto_locate(&media.path, candidate_roots) {
                if located != media.path {
                    let old_path = media.path.clone();
                    let new_path = located.clone();

                    // 更新 timeline clips 中对旧路径的引用
                    for track in &mut project.timeline.tracks {
                        for clip in &mut track.clips {
                            if clip.media_ref == old_path {
                                clip.media_ref = new_path.clone();
                            }
                        }
                    }

                    media.path = located;
                    remapped_count += 1;
                }
            }
        }

        remapped_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nas_path_remapping_prefix() {
        let mut remapper = NasPathRemapper::new();
        remapper.add_rule("/Volumes/NAS/ShortDrama", "Z:\\ShortDrama");

        let original = Path::new("/Volumes/NAS/ShortDrama/Series_01/ep01.mp4");
        let remapped = remapper.remap_path(original);

        assert_eq!(
            remapped.to_string_lossy().replace('\\', "/"),
            "Z:/ShortDrama/Series_01/ep01.mp4"
        );
    }

    #[test]
    fn test_nas_path_auto_locate_fallback() {
        let remapper = NasPathRemapper::new();
        let temp_dir = std::env::temp_dir().join("dramaxis_remap_test");
        let _ = std::fs::create_dir_all(&temp_dir);
        let actual_file = temp_dir.join("sample_clip.mp4");
        let _ = std::fs::write(&actual_file, b"video");

        // 假定原路径是另一台 Mac 上的离线路径
        let offline_path = Path::new("/Users/other_user/Movies/sample_clip.mp4");
        let found = remapper.auto_locate(offline_path, std::slice::from_ref(&temp_dir));

        assert_eq!(found, Some(actual_file.clone()));

        let _ = std::fs::remove_file(actual_file);
        let _ = std::fs::remove_dir(temp_dir);
    }
}
