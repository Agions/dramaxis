//! 创作者资产模板包 (.dramaxis-pack) 打包与导入模块
//!
//! 承载爆款短剧工作室资产复用：
//! - 爆款 Hook 与高转化黄金 3 秒文案提示词预设
//! - 花字与字幕样式预设 (Cinema Amber, Yellow Stroke, Retro Red 等)
//! - 原片母带消重变体预设 (Master & Fission Options)
//! - 矩阵化生产风格 Profile

use crate::master::MasterOptions;
use crate::ExportError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// 资产包元数据与配置主体
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DramaxisPack {
    /// 资产包协议版本 (当前 1.0)
    pub schema_version: String,
    /// 资产包名称 (e.g. "逆袭战神爽剧爆发模版")
    pub name: String,
    /// 作者/工作室名
    pub author: String,
    /// 语义化版本
    pub version: String,
    /// 模版简介
    pub description: String,
    /// 标签分类
    pub tags: Vec<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 脚本提示词模版 (含角色人设与剧情推进风格)
    pub script_prompt_template: Option<String>,
    /// 爆款黄金前3秒 Hook 备选模版列表
    pub hook_templates: Vec<String>,
    /// 字幕花字样式预设标识 (e.g. "cinema-amber", "yellow-stroke")
    pub subtitle_style_preset: Option<String>,
    /// 母带矩阵裂变消重配置
    pub master_options: Option<MasterOptions>,
}

impl Default for DramaxisPack {
    fn default() -> Self {
        Self {
            schema_version: "1.0".to_string(),
            name: "默认短剧爆款模版".to_string(),
            author: "Dramaxis Studio".to_string(),
            version: "1.0.0".to_string(),
            description: "全流程爆款文案 + 黄金 Hook + 母带消重资产包".to_string(),
            tags: vec!["短剧".into(), "解说".into(), "爽剧".into()],
            created_at: Utc::now(),
            script_prompt_template: Some(
                "以第一人称口吻解说短剧，强化打脸反转，每20秒抛出一个核心冲突。".into(),
            ),
            hook_templates: vec![
                "注意看，眼前这个被退婚的男人，竟然就是掌握全球命脉的龙神！".into(),
                "如果不是亲眼所见，谁敢相信首富千金竟在工地上替人洗碗！".into(),
            ],
            subtitle_style_preset: Some("yellow-stroke".into()),
            master_options: Some(MasterOptions::standard()),
        }
    }
}

/// 将资产包导出为标准 JSON 字符串
pub fn export_pack_to_string(pack: &DramaxisPack) -> Result<String, ExportError> {
    serde_json::to_string_pretty(pack).map_err(|e| ExportError::Pack(e.to_string()))
}

/// 将资产包写入目标 `.dramaxis-pack` 文件
pub fn export_pack_file(pack: &DramaxisPack, path: &Path) -> Result<PathBuf, ExportError> {
    let json = export_pack_to_string(pack)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, json)?;
    Ok(path.to_path_buf())
}

/// 从 JSON 字符串解析创作者资产包
pub fn import_pack_from_string(content: &str) -> Result<DramaxisPack, ExportError> {
    serde_json::from_str::<DramaxisPack>(content).map_err(|e| ExportError::Pack(e.to_string()))
}

/// 从目标文件导入创作者资产包
pub fn import_pack_file(path: &Path) -> Result<DramaxisPack, ExportError> {
    let content = fs::read_to_string(path)?;
    import_pack_from_string(&content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_serde_roundtrip() {
        let original = DramaxisPack::default();
        let serialized = export_pack_to_string(&original).expect("pack serialization should work");
        let restored =
            import_pack_from_string(&serialized).expect("pack deserialization should work");

        assert_eq!(original.name, restored.name);
        assert_eq!(original.hook_templates.len(), 2);
        assert_eq!(
            restored.subtitle_style_preset.as_deref(),
            Some("yellow-stroke")
        );
        assert!(restored.master_options.is_some());
    }
}
