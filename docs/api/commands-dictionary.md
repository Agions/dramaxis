# 全量 46 个 Tauri IPC 指令字典 (Commands Dictionary)

本文档汇总了 `splicr` 前后端通信的全部 46 个 Tauri Command，按领域分类整理，列出命令名、入参及返回类型。前后端类型定义由 `scripts/gen-ipc.mjs` 自动同步至 `@splicr/ipc/types.gen.ts`，确保类型安全与单一真相源。

---

## 1. 基础应用与环境 (`app` · 3 个)

| 命令名 (Command)  | 入参 (Payload) | 返回值 (Result) | 语义说明                             |
| :---------------- | :------------- | :-------------- | :----------------------------------- |
| `app_version`     | 无             | `string`        | 获取应用 Semantic Version 版本号     |
| `app_started_at`  | 无             | `string`        | 获取应用启动时间戳                   |
| `app_system_info` | 无             | `AppSystemInfo` | 探测系统环境与 FFmpeg 安装状态及版本 |

---

## 2. 工程管理与持久化 (`project` · 6 个)

| 命令名 (Command)       | 入参 (Payload)                                         | 返回值 (Result) | 语义说明                                 |
| :--------------------- | :----------------------------------------------------- | :-------------- | :--------------------------------------- |
| `project_create_blank` | 无                                                     | `ProjectRecord` | 在应用工作区创建新的空白项目工程         |
| `project_list_recent`  | 无                                                     | `string[]`      | 获取本地最近打开的工程文件路径列表       |
| `project_load`         | `{ path: string }`                                     | `ProjectRecord` | 从磁盘读取完整工程实体与多轨时间轴快照   |
| `project_save`         | `{ path: string, project: Project }`                   | `void`          | 将工程实体原子化写入磁盘 `.splicr` 文件  |
| `project_delete`       | `{ path: string }`                                     | `void`          | 删除指定路径工程文件并移出最近列表       |
| `project_add_media`    | `{ path: string, project: Project, media: MediaFile }` | `Project`       | 向指定工程追加素材文件并同步更新工程实体 |

---

## 3. 素材资产管理与探针 (`assets` & `detect` · 6 个)

| 命令名 (Command)               | 入参 (Payload)                              | 返回值 (Result)              | 语义说明                                                     |
| :----------------------------- | :------------------------------------------ | :--------------------------- | :----------------------------------------------------------- |
| `assets_scan`                  | `{ dir: string, recursive?: boolean }`      | `ScanResult`                 | 扫描指定目录下的媒体文件（视频、音频、图片）                 |
| `assets_metadata`              | `{ path: string }`                          | `FfmpegProbe`                | 通过 FFprobe 提取媒体编码、分辨率、帧率与码率                |
| `assets_thumbnail`             | `{ path: string, width?: number }`          | `ThumbnailResult`            | 截取视频首帧并生成 Base64 快速预览缩略图                     |
| `assets_search`                | `{ mediaPaths: string[], pattern: string }` | `string[]`                   | 在素材列表内进行文件名模糊匹配与过滤                         |
| `detect_scenes`                | `{ filePath: string, threshold?: number }`  | `DetectScenesResult`         | 基于 FFmpeg 突变打点检测视频场景分镜切片点                   |
| `detect_hardware_acceleration` | 无                                          | `HardwareAccelerationKind[]` | 探测本机支持的 GPU 编解码硬件加速器 (VideoToolbox/NVENC/QSV) |

---

## 4. 智能体与脚本编排 (`agent` & `script` · 4 个)

| 命令名 (Command)    | 入参 (Payload)                            | 返回值 (Result)             | 语义说明                                       |
| :------------------ | :---------------------------------------- | :-------------------------- | :--------------------------------------------- |
| `agent_start`       | `{ project: Project, autoMode: boolean }` | `AgentContext`              | 初始化 6-Agent 协同引擎会话并启动编排流转      |
| `agent_step`        | `{ stepIdx: number }`                     | `BreakpointRequest \| null` | 推进指定步骤，若遇到人机协同断点则返回审查请求 |
| `agent_get_context` | 无                                        | `AgentContext \| null`      | 获取当前活跃会话的智能体记忆区与流式产物快照   |
| `script_generate`   | `{ params: ScriptGenerateParams }`        | `ScriptGenerateResult`      | 直接调用指定的大模型 API 生成分段解说独白      |

---

## 5. 语音、字幕与流水线编排 (`voice`, `subtitle`, `pipeline`, `video` · 8 个)

| 命令名 (Command)     | 入参 (Payload)                                                           | 返回值 (Result)          | 语义说明                                   |
| :------------------- | :----------------------------------------------------------------------- | :----------------------- | :----------------------------------------- |
| `voice_preview`      | `{ params: VoicePreviewParams }`                                         | `VoicePreviewResult`     | 快速合成单句解说台词并返回试听音频路径     |
| `voice_synthesize`   | `{ params: VoicePreviewParams, outputPath: string }`                     | `VoicePreviewResult`     | 批量合成完整解说独白并持久化至指定音频文件 |
| `subtitle_generate`  | `{ params: SubtitleGenerateParams }`                                     | `SubtitleGenerateResult` | 基于 Silero VAD 语音停顿切分，生成对齐字幕 |
| `pipeline_step_defs` | 无                                                                       | `PipelineStepDef[]`      | 获取流水线标准阶段定义列表                 |
| `pipeline_status`    | 无                                                                       | `PipelineStatus`         | 查询当前流水线运行状态与各步骤进度         |
| `pipeline_start`     | `{ project: Project, workdir?: string }`                                 | `void`                   | 启动 5 步自动化处理流水线                  |
| `pipeline_cancel`    | 无                                                                       | `void`                   | 取消正在运行的合成流水线                   |
| `pipeline_reset`     | 无                                                                       | `void`                   | 重置流水线状态机回初始状态                 |
| `video_build_plans`  | `{ sources: string[], strategy: ExportStrategy, options?: PlanOptions }` | `OutputPlan[]`           | 计算批量/合集分集导出方案                  |

---

## 6. 生产交付与视频渲染 (`export` · 5 个)

| 命令名 (Command)          | 入参 (Payload)                                      | 返回值 (Result)     | 语义说明                                        |
| :------------------------ | :-------------------------------------------------- | :------------------ | :---------------------------------------------- |
| `export_plan`             | `{ mode: ExportMode, settings?: ProjectSettings }`  | `ExportPlan`        | 规划目标工程的码率、分辨率与格式矩阵            |
| `export_validate_params`  | `{ params: ExportParams }`                          | `void`              | 校验音画参数、容器格式与分辨率合法性            |
| `export_render_subtitles` | `{ items: SubtitleItem[], format: SubtitleFormat }` | `string`            | 格式化导出 SRT/VTT/ASS 逐字高亮字幕内容         |
| `export_capcut_draft`     | `{ params: CapcutDraftOptions }`                    | `CapcutDraftResult` | 自动探测并直接输出剪映 PC 端原生工程草稿库      |
| `export_render_video`     | `{ params: RenderVideoParams }`                     | `RenderVideoResult` | 调用硬件加速 FFmpeg 执行滤镜烧录并压制 MP4 成片 |

---

## 7. 系统配置、国际化、更新与帮助 (`settings`, `i18n`, `update`, `help` · 13 个)

| 命令名 (Command)   | 入参 (Payload)                                   | 返回值 (Result)       | 语义说明                                    |
| :----------------- | :----------------------------------------------- | :-------------------- | :------------------------------------------ |
| `settings_get`     | 无                                               | `ConfigSnapshot`      | 从安全凭据区与本地读取当前配置快照          |
| `settings_set`     | `{ snapshot: ConfigSnapshot }`                   | `void`                | 持久化用户的大模型密钥、音色与导出首选项    |
| `i18n_get_locale`  | 无                                               | `string`              | 获取系统后端当前设置的语言（zh-CN / en-US） |
| `i18n_set_locale`  | `{ locale: string }`                             | `boolean`             | 切换系统后端语言字典                        |
| `i18n_translate`   | `{ key: string, args?: Record<string, string> }` | `string`              | 翻译指定文案键值并插值                      |
| `update_get_state` | 无                                               | `UpdateState`         | 读取应用自更新状态机当前快照                |
| `update_check`     | 无                                               | `UpdateInfo`          | 请求 GitHub Releases 检查远端最新版本       |
| `update_download`  | 无                                               | `string`              | 断点续传下载新版本安装包至系统临时目录      |
| `update_install`   | 无                                               | `UpdateInstallResult` | 执行安装包权限变更并唤起系统更新程序        |
| `update_reset`     | 无                                               | `void`                | 重置更新状态机至 Idle                       |
| `help_topics`      | `{ category?: string }`                          | `HelpTopic[]`         | 获取内置使用帮助指南专题列表                |
| `help_topic_get`   | `{ id: string }`                                 | `HelpTopic`           | 根据 ID 读取指定帮助专题富文本内容          |
| `help_search`      | `{ query: string }`                              | `SearchHit[]`         | 全文检索内置帮助文档知识库                  |
