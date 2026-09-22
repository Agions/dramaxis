# 全量 44 个 Tauri IPC 指令字典 (Commands Dictionary)

本文档汇总了 `splicr` 前后端通信的全部 44 个 Tauri Command，按领域分类整理，列出命令名、入参及返回类型。

---

## 1. 项目与工程管理 (`project`)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `project_list` | 无 | `ProjectRecord[]` | 获取所有本地历史工程列表 |
| `project_create_blank` | `{ title?: string }` | `ProjectRecord` | 创建空白项目工程 |
| `project_load` | `{ id: string }` | `Project` | 读取完整工程实体与 5 轨时间轴 |
| `project_save` | `{ project: Project }` | `void` | 持久化保存工程快照 |
| `project_delete` | `{ id: string }` | `void` | 删除指定项目及关联缓存 |
| `project_recent` | `{ limit?: number }` | `ProjectRecord[]` | 查询最近打开的项目 |

---

## 2. 媒体与素材资产 (`assets` & `detect`)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `assets_scan` | `{ dir_path: string }` | `ScanResult` | 扫描指定目录下的音视频资产 |
| `assets_search` | `{ query: string }` | `AssetEntry[]` | 模糊搜索素材库 |
| `assets_get_thumbnail` | `{ asset_id: string }` | `ThumbnailResult` | 获取指定素材的关键帧缩略图 |
| `assets_delete` | `{ asset_id: string }` | `void` | 从素材库中移除素材引用 |
| `detect_scenes` | `{ video_path: string }` | `DetectScenesResult` | 调用 FFmpeg 执行场景突变分析 |

---

## 3. 智能体与脚本编排 (`agent` & `script`)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `agent_start` | `{ role: AgentRole }` | `void` | 启动指定角色的智能体推演 |
| `agent_pause` | 无 | `void` | 暂停当前运行中的智能体 |
| `agent_resume` | `{ breakpoint?: BreakpointRequest }` | `void` | 恢复智能体运行 |
| `script_generate` | `ScriptGenerateParams` | `ScriptGenerateResult` | 调用指定 LLM 生成分段解说脚本 |

---

## 4. 语音、字幕与合成 (`voice`, `subtitle`, `compose`, `export`)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `voice_preview` | `VoicePreviewParams` | `VoicePreviewResult` | 合成单句旁白音频并返回试听路径 |
| `voice_list_providers` | 无 | `TtsProviderKind[]` | 列出当前可用的 TTS 引擎 |
| `subtitle_generate` | `SubtitleGenerateParams` | `SubtitleGenerateResult` | 基于 VAD 生成 SRT/ASS 字幕 |
| `pipeline_start` | `{ options: PlanOptions }` | `void` | 启动 5 轨合成全流程流水线 |
| `pipeline_cancel` | 无 | `void` | 取消当前流水线 |
| `pipeline_status` | 无 | `PipelineStatus` | 获取当前合成进度与各步骤状态 |
| `export_capcut_draft` | `ExportParams` | `CapcutDraftResult` | 输出剪映 PC 端原生工程草稿 |
| `export_video` | `ExportParams` | `ExportRecord` | 调用 FFmpeg 执行转码导出 |

---

## 5. 系统、主题与版本更新 (`app`, `settings`, `theme`, `update`, `help`)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `app_get_system_info` | 无 | `SystemInfo` | 获取系统架构、CPU、GPU 硬件信息 |
| `app_check_ffmpeg` | 无 | `boolean` | 检测系统是否具备 FFmpeg 运行环境 |
| `settings_get` | 无 | `ConfigSnapshot` | 读取配置快照 |
| `settings_save` | `{ config: ConfigSnapshot }` | `void` | 保存配置至系统安全凭据区 |
| `theme_get` | 无 | `string` | 读取当前调色台主题模式 |
| `theme_set` | `{ theme: string }` | `void` | 设置主题模式并持久化 |
| `update_get_state` | 无 | `UpdateState` | 获取当前版本自更新状态快照 |
| `update_check` | 无 | `UpdateInfo` | 直连 GitHub Releases 探测最新版 |
| `update_download` | 无 | `string` | 高速断点续传下载新版本安装包 |
| `update_install` | 无 | `UpdateInstallResult` | 执行权限赋予与应用重启更新 |
| `update_reset` | 无 | `void` | 重置更新状态机至 Idle |
| `help_topics` | `{ category?: string }` | `HelpTopic[]` | 获取官方帮助文档与专题分类 |
| `help_search` | `{ query: string }` | `SearchHit[]` | 检索内置知识库 |
