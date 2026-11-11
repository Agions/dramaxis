# 全量 Tauri IPC 指令契约字典 (Commands Dictionary)

本文档汇总了 **Dramaxis (剧枢)** 前后端通信的全部 Tauri Command，按业务领域分类整理，列出命令名、入参及返回类型。前后端类型定义由 `pnpm gen:ipc` 自动同步至 `@dramaxis/ipc/src/types.gen.ts`，确保类型绝对安全与单一真相源。

---

## 1. 基础应用与环境 (`app` · 3 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `app_version` | 无 | `string` | 获取应用当前语义化版本号 (SemVer) |
| `app_started_at` | 无 | `string` | 获取当前进程启动绝对时间戳 |
| `app_system_info` | 无 | `AppSystemInfo` | 探测操作系统、CPU 架构与 FFmpeg 引擎版本 |

---

## 2. 工程管理与事务持久化 (`project` · 6 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `project_create_blank` | 无 | `ProjectRecord` | 在应用工作区创建新的空白项目工程 |
| `project_list_recent` | 无 | `string[]` | 获取本地最近打开的工程文件路径列表 |
| `project_load` | `{ path: string }` | `ProjectRecord` | 从磁盘读取完整工程实体与 5 轨时间轴快照 |
| `project_save` | `{ path: string, project: Project }` | `void` | 将工程实体原子化写入磁盘 `.dramaxis` 归档 |
| `project_delete` | `{ path: string }` | `void` | 删除指定路径工程文件并移出最近列表 |
| `project_add_media` | `{ path: string, project: Project, media: MediaFile }` | `Project` | 向指定工程追加素材文件并同步更新工程实体 |

---

## 3. 素材资产管理与探针 (`assets` & `detect` · 6 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `assets_scan` | `{ dir: string, recursive?: boolean }` | `ScanResult` | 扫描指定目录下的音视频媒体文件白名单 |
| `assets_metadata` | `{ path: string }` | `FfmpegProbe` | 通过 FFprobe 提取媒体编码、分辨率、帧率与声道 |
| `assets_thumbnail` | `{ path: string, width?: number }` | `ThumbnailResult` | 截取视频关键帧并生成快速预览缩略图 |
| `assets_search` | `{ mediaPaths: string[], pattern: string }` | `string[]` | 在素材列表内进行文件名模糊匹配与过滤 |
| `detect_scenes` | `{ filePath: string, threshold?: number }` | `DetectScenesResult` | 基于 FFmpeg 突变打点检测视频场景分镜切片点 |
| `detect_hardware_acceleration` | 无 | `HardwareAccelerationKind[]` | 探测本机支持的 GPU 硬件编解码加速器 (VideoToolbox/NVENC/QSV) |

---

## 4. 多智能体状态图编排与剧本飞轮 (`agent` & `script` · 9 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `agent_start` | `{ project: Project, autoMode: boolean, workflowProfile?: WorkflowProfile }` | `AgentContext` | 初始化 6-Agent 引擎会话并注入安全脱敏凭证 |
| `agent_run_dag` | 无 | `BreakpointRequest \| null` | 触发完整的 StateGraph 状态机推演与反思闭环 |
| `agent_resume_breakpoint` | `{ action: string, feedback?: string }` | `BreakpointRequest \| null` | 恢复 HITL 人机断点并传入针对性自然语言指令 |
| `agent_get_dag_snapshot` | 无 | `DagSnapshot \| null` | 获取当前 DAG 调度快照、耗时与反思轮次 |
| `agent_get_context` | 无 | `AgentContext \| null` | 获取当前活跃会话脱敏后的上下文与思考流快照 |
| `agent_get_blackboard` | 无 | `Blackboard \| null` | 获取强类型版本化黑板总线快照 |
| `agent_rollback_script` | `{ version: number }` | `boolean` | 将剧本文案与分镜回滚至指定历史版本 |
| `agent_step` | `{ stepIdx: number }` | `BreakpointRequest \| null` | 执行单步智能体调度 (兼容旧版调用) |
| `script_generate` | `{ params: ScriptGenerateParams }` | `ScriptGenerateResult` | 直接调用指定的 LLM 网关生成分段独白剧本 |

---

## 5. 语音合成、字幕与流水线编排 (`voice`, `subtitle`, `pipeline`, `video` · 8 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `voice_preview` | `{ params: VoicePreviewParams }` | `VoicePreviewResult` | 快速合成单句解说台词并返回试听音频路径 |
| `voice_synthesize` | `{ params: VoicePreviewParams, outputPath: string }` | `VoicePreviewResult` | 批量合成完整解说独白并重采样为 48kHz |
| `subtitle_generate` | `{ params: SubtitleGenerateParams }` | `SubtitleGenerateResult` | 基于 FFmpeg silencedetect VAD 端点检测生成对齐字幕 |
| `pipeline_step_defs` | 无 | `PipelineStepDef[]` | 获取 7 步基础流水线标准阶段定义列表 |
| `pipeline_status` | 无 | `PipelineStatus` | 查询当前底层流水线运行状态与各步骤进度 |
| `pipeline_start` | `{ project: Project, workdir?: string }` | `void` | 启动底层基础流水线 |
| `pipeline_cancel` | 无 | `void` | 取消正在运行的合成流水线 (步边界生效) |
| `video_build_plans` | `{ sources: string[], strategy: ExportStrategy, options?: PlanOptions }` | `OutputPlan[]` | 依据 4 大策略计算批量/合集分集计划 |

---

## 6. 生产交付、剪映草稿与母带压制 (`export` · 6 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `export_capcut_draft` | `{ params: CapcutDraftOptions }` | `CapcutDraftResult` | 自动探测剪映目录并秒级输出 PC 端原生工程草稿 |
| `export_render_video` | `{ params: RenderVideoParams }` | `RenderVideoResult` | 硬件加速渲染多平台标准母带 (9:16 / 16:9) |
| `export_batch_fission` | `{ params: BatchFissionParams }` | `BatchFissionResult` | 多版本母带批量并行渲染与微调参数分发 |
| `export_plan` | `{ mode: ExportMode, settings?: ProjectSettings }` | `ExportPlan` | 规划目标工程的码率、分辨率与格式矩阵 |
| `export_validate_params` | `{ params: ExportParams }` | `void` | 校验音画参数、容器格式与分辨率合法性 |
| `export_render_subtitles` | `{ items: SubtitleItem[], format: SubtitleFormat }` | `string` | 格式化导出 SRT/VTT/ASS 逐字高亮字幕内容 |

---

## 7. 系统配置、国际化、更新与帮助 (`settings`, `i18n`, `update`, `help` · 13 个)

| 命令名 (Command) | 入参 (Payload) | 返回值 (Result) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `settings_get` | 无 | `ConfigSnapshot` | 从安全凭据区与本地读取当前配置快照 |
| `settings_set` | `{ snapshot: ConfigSnapshot }` | `void` | 安全持久化大模型密钥、音色与首选画幅 |
| `i18n_get_locale` | 无 | `string` | 获取系统当前语言标识 (zh-CN / en-US) |
| `i18n_set_locale` | `{ locale: string }` | `boolean` | 切换系统多语言字典 |
| `i18n_translate` | `{ key: string, args?: Record<string, string> }` | `string` | 翻译指定文案键值并插值 |
| `update_get_state` | 无 | `UpdateState` | 读取应用自更新状态机当前快照 |
| `update_check` | 无 | `UpdateInfo` | 请求 GitHub Releases 检查远端最新版本 |
| `update_download` | 无 | `string` | HTTP Range 断点续传下载新版本安装包 |
| `update_install` | 无 | `UpdateInstallResult` | 原子替换本地二进制并优雅重启应用 |
| `update_reset` | 无 | `void` | 重置更新状态机至 Idle |
| `help_topics` | `{ category?: string }` | `HelpTopic[]` | 获取内置使用帮助指南专题列表 |
| `help_topic_get` | `{ id: string }` | `HelpTopic` | 根据 ID 读取指定帮助专题富文本内容 |
| `help_search` | `{ query: string }` | `SearchHit[]` | 全文检索内置帮助文档知识库 |
