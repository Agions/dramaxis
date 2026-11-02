//! dramaxis src-tauri · Tauri 命令分组
//!
//! 业务域分 module:
//! - [`app`]      : 应用元信息 + 系统探测 (3 个)
//! - [`project`]  : 项目 CRUD + Undo/Redo (8 个)
//! - [`pipeline`] : 7 步运行时与声画对齐 (6 个)
//! - [`settings`] : 配置持久化与连接探测 (4 个)
//! - [`update`]   : 应用更新器 (5 个)
//! - [`assets`]   : 素材资产管理 (4 个)
//! - [`export`]   : 导出参数规划 + 字幕渲染 + 成片/草稿/裂变编排 (8 个)
//! - [`help`]     : 内置帮助主题 + 加权搜索 (3 个)
//! - [`theme`]    : 后端文案 / Locale 切换 (3 个)
//! - [`agent`]    : 多智能体 DAG 工作流编排与断点审批
//! - [`detect`]   : 镜头切换检测与多模态视觉特征抽取
//! - [`script`]   : 黄金高光钩子、留存弧线与爆款逆向拆解
//! - [`subtitle`] : 花字与卡拉 OK 字幕样式渲染
//! - [`voice`]    : 多引擎 TTS 语音合成与声音克隆

pub mod agent;
pub mod app;
pub mod assets;
pub mod detect;
pub mod export;
pub mod help;
pub mod pipeline;
pub mod project;
pub mod script;
pub mod settings;
pub mod subtitle;
pub mod theme;
pub mod update;
pub mod voice;
