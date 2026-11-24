/**
 * dramaxis v1.1.0 · IPC Commands 类型化包装
 *
 * 设计:
 * - 每个方法直接对应一个 Tauri command,compile-time 类型由 types.gen.ts 保障
 * - 此层不持有状态、不缓存;纯函数式 facade
 * - 全部 35 个 commands 在 M4.5 已落地 (M3.2: 17 + M4: 5 update + M4.5: 10 export/help/theme)
 */

import { callIpc } from "./client";
import type {
  AgentContext,
  AgentMessage,
  BreakpointRequest,
  ProjectRecord,
  ConfigSnapshot,
  AppSystemInfo,
  ExportMode,
  ExportParams,
  ExportStrategy,
  FfmpegProbe,
  HelpCategory,
  HelpTopic,
  MediaFile,
  Timeline,
  OutputPlan,
  PipelineStatus,
  PipelineStepDef,
  PlanOptions,
  Project,
  ProjectSettings,
  ScanResult,
  ScriptGenerateParams,
  ScriptGenerateResult,
  HookCandidate,
  SearchHit,
  SubtitleFormat,
  SubtitleItem,
  ThumbnailResult,
  CapcutDraftResult,
  CapcutDraftOptions,
  RenderVideoParams,
  RenderVideoResult,
  DetectScenesResult,
  SubtitleGenerateParams,
  SubtitleGenerateResult,
  HardwareAccelerationKind,
  UpdateInfo,
  UpdateInstallResult,
  UpdateState,
  VoicePreviewParams,
  VoicePreviewResult,
  DagSnapshot,
  DedupIntensity,
  DedupOptions,
  BatchFissionParams,
  BatchFissionResult,
  LlmTestResult,
  FissionVariantResult,
  FissionProgressPayload,
  SceneVisualFeature,
  StyleProfile,
  RetentionTensionArc,
  AlignmentPlan,
  AlignmentMatch,
  Blackboard,
  WorkflowProfile,
  ShotAnnotation,
  ScriptArtifact,
  Series,
  Episode,
  StoryBible,
  Variant,
  EpisodeRecap,
  CharacterProfile,
  AsrConfig,
  TranscriptResult,
  TranscriptSegment,
  AsrTestResult,
  ProxyConfig,
  ProxyArtifact,
  WaveformPeaks,
  PreFlightDedupReport,
  SubtitleMaskMode,
  BatchJob,
  BatchJobStatus,
  BatchJobType,
  PathMappingRule,
  NasPathRemapper,
  ScriptSegmentHit,
  ComputeNodeConfig,
  ComputeHealth,
  ComputeNodeKind,
  FcpxmlOptions,
  DramaxisPack,
} from "./types.gen";

export type {
  BatchJob,
  BatchJobStatus,
  BatchJobType,
  PathMappingRule,
  NasPathRemapper,
  ScriptSegmentHit,
  ComputeNodeConfig,
  ComputeHealth,
  ComputeNodeKind,
  FcpxmlOptions,
  DramaxisPack,
  AgentContext,
  AgentMessage,
  BreakpointRequest,
  DagSnapshot,
  ProjectRecord,
  ConfigSnapshot,
  DedupIntensity,
  DedupOptions,
  BatchFissionParams,
  BatchFissionResult,
  LlmTestResult,
  FissionVariantResult,
  FissionProgressPayload,
  SceneVisualFeature,
  StyleProfile,
  RetentionTensionArc,
  AlignmentPlan,
  AlignmentMatch,
  WorkflowProfile,
  ShotAnnotation,
  ScriptArtifact,
  Series,
  Episode,
  StoryBible,
  Variant,
  EpisodeRecap,
  CharacterProfile,
  AsrConfig,
  TranscriptResult,
  TranscriptSegment,
  AsrTestResult,
  ProxyConfig,
  ProxyArtifact,
  WaveformPeaks,
  PreFlightDedupReport,
  SubtitleMaskMode,
};

export type MasterOptions = DedupOptions;

// ─────────────────────────────────────────────────────────────────────────
// app · 应用信息 (3/3)
// ─────────────────────────────────────────────────────────────────────────

export const appIpc = {
  version: () => callIpc("app_version"),
  startedAt: () => callIpc("app_started_at"),
  systemInfo: (): Promise<AppSystemInfo> => callIpc("app_system_info"),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// project · 项目管理 (6/6)
// ─────────────────────────────────────────────────────────────────────────

export const projectIpc = {
  listRecent: () => callIpc("project_list_recent"),
  createBlank: (): Promise<ProjectRecord> => callIpc("project_create_blank"),
  load: (path: string): Promise<ProjectRecord> =>
    callIpc("project_load", { path }),
  save: (path: string, project: Project): Promise<void> =>
    callIpc("project_save", { path, project }),
  remove: (path: string): Promise<void> => callIpc("project_delete", { path }),
  addMedia: (
    path: string,
    project: Project,
    media: MediaFile,
  ): Promise<Project> => callIpc("project_add_media", { path, project, media }),
  undo: (path: string, projectId: string): Promise<Project | null> =>
    callIpc("project_undo", { path, projectId }),
  redo: (path: string, projectId: string): Promise<Project | null> =>
    callIpc("project_redo", { path, projectId }),
  saveSeries: (series: Series, bundlePath?: string | null): Promise<void> =>
    callIpc("project_series_save", { series, bundlePath: bundlePath ?? null }),
  listSeries: (bundlePath?: string | null): Promise<Series[]> =>
    callIpc("project_series_list", { bundlePath: bundlePath ?? null }),
  saveStoryBible: (bible: StoryBible, bundlePath?: string | null): Promise<void> =>
    callIpc("project_story_bible_save", { bible, bundlePath: bundlePath ?? null }),
  loadStoryBible: (
    seriesId: string,
    bundlePath?: string | null,
  ): Promise<StoryBible | null> =>
    callIpc("project_story_bible_load", { seriesId, bundlePath: bundlePath ?? null }),
  saveEpisode: (episode: Episode, bundlePath?: string | null): Promise<void> =>
    callIpc("project_episode_save", { episode, bundlePath: bundlePath ?? null }),
  listEpisodes: (
    seriesId: string,
    bundlePath?: string | null,
  ): Promise<Episode[]> =>
    callIpc("project_episode_list", { seriesId, bundlePath: bundlePath ?? null }),
  saveVariant: (variant: Variant, bundlePath?: string | null): Promise<void> =>
    callIpc("project_variant_save", { variant, bundlePath: bundlePath ?? null }),
  listVariants: (
    episodeId: string,
    bundlePath?: string | null,
  ): Promise<Variant[]> =>
    callIpc("project_variant_list", { episodeId, bundlePath: bundlePath ?? null }),
  remapNasPaths: (
    project: Project,
    rules: PathMappingRule[],
    candidateRoots: string[],
  ): Promise<Project> =>
    callIpc("project_remap_nas_paths", { project, rules, candidateRoots }),
  searchScriptSegments: (
    query: string,
    projectId?: string | null,
    limit?: number | null,
    bundlePath?: string | null,
  ): Promise<ScriptSegmentHit[]> =>
    callIpc("project_search_script_segments", {
      query,
      projectId: projectId ?? null,
      limit: limit ?? null,
      bundlePath: bundlePath ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// pipeline · 7 步流水线 (5/5 命令)
// ─────────────────────────────────────────────────────────────────────────

export const pipelineIpc = {
  stepDefs: (): Promise<PipelineStepDef[]> => callIpc("pipeline_step_defs"),
  status: (): Promise<PipelineStatus> => callIpc("pipeline_status"),
  start: (project: Project, workdir?: string): Promise<void> =>
    callIpc("pipeline_start", { project, workdir: workdir ?? null }),
  cancel: (): Promise<void> => callIpc("pipeline_cancel"),
  reset: (): Promise<void> => callIpc("pipeline_reset"),
  alignScriptWithScenes: (
    scenes: SceneVisualFeature[],
    scriptLines: string[],
    voiceDuration?: number | null,
  ): Promise<AlignmentPlan> =>
    callIpc("compose_align_script_with_scenes", {
      scenes,
      scriptLines,
      voiceDuration: voiceDuration ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// settings · 配置与密钥 (2/2)
// ─────────────────────────────────────────────────────────────────────────

export const settingsIpc = {
  get: (): Promise<ConfigSnapshot> => callIpc("settings_get"),
  set: (snapshot: ConfigSnapshot): Promise<void> =>
    callIpc("settings_set", { snapshot }),
  testLlm: (params: {
    provider: string;
    apiKey: string;
    model?: string | null;
    baseUrl?: string | null;
  }): Promise<LlmTestResult> =>
    callIpc("settings_test_llm", {
      provider: params.provider,
      apiKey: params.apiKey,
      model: params.model ?? null,
      baseUrl: params.baseUrl ?? null,
    }),
  testAsr: (params: {
    provider: string;
    whisperCliPath?: string | null;
    whisperModelPath?: string | null;
    apiBaseUrl?: string | null;
    apiKey?: string | null;
    apiModel?: string | null;
  }): Promise<AsrTestResult> =>
    callIpc("settings_test_asr", {
      provider: params.provider,
      whisperCliPath: params.whisperCliPath ?? null,
      whisperModelPath: params.whisperModelPath ?? null,
      apiBaseUrl: params.apiBaseUrl ?? null,
      apiKey: params.apiKey ?? null,
      apiModel: params.apiModel ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// update · 应用更新器 (5/5 · M4 完整实装)
// ─────────────────────────────────────────────────────────────────────────

export const updateIpc = {
  getState: (): Promise<UpdateState> => callIpc("update_get_state"),
  check: (): Promise<UpdateInfo> => callIpc("update_check"),
  download: (): Promise<string> => callIpc("update_download"),
  install: (): Promise<UpdateInstallResult> => callIpc("update_install"),
  reset: (): Promise<void> => callIpc("update_reset"),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// assets · 素材资产管理 (4/4 命令)
// ─────────────────────────────────────────────────────────────────────────

export const assetsIpc = {
  scan: (dir: string, recursive = false): Promise<ScanResult> =>
    callIpc("assets_scan", { dir, recursive }),
  metadata: (path: string): Promise<FfmpegProbe> =>
    callIpc("assets_metadata", { path }),
  thumbnail: (path: string, width = 320): Promise<ThumbnailResult> =>
    callIpc("assets_thumbnail", { path, width }),
  search: (mediaPaths: string[], pattern: string): Promise<string[]> =>
    callIpc("assets_search", { mediaPaths, pattern }),
  generateProxy: (
    sourcePath: string,
    config?: ProxyConfig | null,
  ): Promise<ProxyArtifact> =>
    callIpc("assets_generate_proxy", { sourcePath, config: config ?? null }),
  getWaveformPeaks: (
    sourcePath: string,
    buckets?: number | null,
  ): Promise<WaveformPeaks> =>
    callIpc("assets_get_waveform_peaks", {
      sourcePath,
      buckets: buckets ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// export · 导出参数规划 + 字幕渲染 + 多视频编排
// ─────────────────────────────────────────────────────────────────────────

export const exportIpc = {
  plan: (mode: ExportMode, settings?: ProjectSettings | null) =>
    callIpc("export_plan", { mode, settings: settings ?? null }),
  validateParams: (params: ExportParams) =>
    callIpc("export_validate_params", { params }),
  renderSubtitles: (items: SubtitleItem[], format: SubtitleFormat) =>
    callIpc("export_render_subtitles", { items, format }),
  capcutDraft: (params: CapcutDraftOptions): Promise<CapcutDraftResult> =>
    callIpc("export_capcut_draft", { params }),
  renderVideo: (params: RenderVideoParams): Promise<RenderVideoResult> =>
    callIpc("export_render_video", { params }),
  getDedupPreset: (intensity: DedupIntensity): Promise<DedupOptions> =>
    callIpc("export_get_dedup_preset", { intensity }),
  batchFission: (params: BatchFissionParams): Promise<BatchFissionResult> =>
    callIpc("export_batch_fission", { params }),
  openFolder: (path: string): Promise<void> =>
    callIpc("export_open_folder", { path }),
  launchJianying: (): Promise<void> =>
    callIpc("export_launch_jianying"),
  evaluatePreflight: (
    options: DedupOptions,
    hasOriginalClips?: boolean | null,
    hardSubDetected?: boolean | null,
  ): Promise<PreFlightDedupReport> =>
    callIpc("export_evaluate_preflight", {
      options,
      hasOriginalClips: hasOriginalClips ?? null,
      hardSubDetected: hardSubDetected ?? null,
    }),
  fcpxml: (
    timeline: Timeline,
    mediaFiles: MediaFile[],
    options: FcpxmlOptions,
    outputPath: string,
  ): Promise<string> =>
    callIpc("export_fcpxml_timeline", {
      timeline,
      mediaFiles,
      options,
      outputPath,
    }),
  exportPack: (pack: DramaxisPack, outputPath: string): Promise<string> =>
    callIpc("export_template_pack", { pack, outputPath }),
  importPack: (packPath: string): Promise<DramaxisPack> =>
    callIpc("import_template_pack", { packPath }),
} as const;

export const detectIpc = {
  hardwareAcceleration: (): Promise<HardwareAccelerationKind[]> =>
    callIpc("detect_hardware_acceleration"),
  scenes: (
    filePath: string,
    threshold?: number | null,
  ): Promise<DetectScenesResult> =>
    callIpc("detect_scenes", { filePath, threshold: threshold ?? null }),
  analyzeScenesRag: (
    filePath: string,
    cuts?: number[] | null,
  ): Promise<SceneVisualFeature[]> =>
    callIpc("detect_analyze_scenes_rag", { filePath, cuts: cuts ?? null }),
} as const;

export const subtitleIpc = {
  generate: (params: SubtitleGenerateParams): Promise<SubtitleGenerateResult> =>
    callIpc("subtitle_generate", { params }),
  transcribe: (
    mediaPath: string,
    config?: AsrConfig | null,
  ): Promise<TranscriptResult> =>
    callIpc("subtitle_asr_transcribe", {
      mediaPath,
      config: config ?? null,
    }),
} as const;

export const videoIpc = {
  buildPlans: (
    sources: string[],
    strategy: ExportStrategy,
    options?: PlanOptions | null,
  ): Promise<OutputPlan[]> =>
    callIpc("video_build_plans", {
      sources,
      strategy,
      options: options ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// help · 内置帮助主题 + 加权搜索 (3/3 · M5.7 接 dramaxis-core::help)
// ─────────────────────────────────────────────────────────────────────────

export const helpIpc = {
  topics: (category?: HelpCategory | null): Promise<HelpTopic[]> =>
    callIpc("help_topics", { category: category ?? null }),
  topicGet: (id: string): Promise<HelpTopic> =>
    callIpc("help_topic_get", { id }),
  search: (query: string): Promise<SearchHit[]> =>
    callIpc("help_search", { query }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// theme · 后端文案 / Locale 切换 (3/3 · M5.6 接 dramaxis-core::i18n)
// ─────────────────────────────────────────────────────────────────────────

export const themeIpc = {
  getLocale: (): Promise<string> => callIpc("i18n_get_locale"),
  setLocale: (locale: string): Promise<boolean> =>
    callIpc("i18n_set_locale", { locale }),
  translate: (
    key: string,
    args?: Record<string, string> | null,
  ): Promise<string> => callIpc("i18n_translate", { key, args: args ?? null }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// voice · TTS 试听与合成
// ─────────────────────────────────────────────────────────────────────────

export const voiceIpc = {
  preview: (params: VoicePreviewParams): Promise<VoicePreviewResult> =>
    callIpc("voice_preview", { params }),
  synthesize: (
    params: VoicePreviewParams,
    outputPath: string,
  ): Promise<VoicePreviewResult> =>
    callIpc("voice_synthesize", { params, outputPath }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// script · AI 独白脚本生成
// ─────────────────────────────────────────────────────────────────────────

export const scriptIpc = {
  generate: (params: ScriptGenerateParams): Promise<ScriptGenerateResult> =>
    callIpc("script_generate", { params }),
  generateHooks: (synopsis: string): Promise<HookCandidate[]> =>
    callIpc("script_generate_hooks", { synopsis }),
  deconstructReference: (text: string): Promise<StyleProfile> =>
    callIpc("script_deconstruct_reference", { text }),
  calculateRetentionArc: (
    script: string,
    durationSec?: number | null,
  ): Promise<RetentionTensionArc> =>
    callIpc("script_calculate_retention_arc", {
      script,
      durationSec: durationSec ?? null,
    }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// 聚合 facade
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// agent · 多智能体协同引擎
// ─────────────────────────────────────────────────────────────────────────

export const agentIpc = {
  start: (
    project: Project,
    autoMode: boolean,
    workflowProfile?: WorkflowProfile,
  ): Promise<AgentContext> =>
    callIpc("agent_start", {
      project,
      autoMode,
      workflowProfile: workflowProfile ?? null,
    }),
  step: (stepIdx: number): Promise<BreakpointRequest | null> =>
    callIpc("agent_step", { stepIdx }),
  runDag: (): Promise<BreakpointRequest | null> => callIpc("agent_run_dag"),
  resumeBreakpoint: (
    action: string,
    feedback: string | null = null,
  ): Promise<BreakpointRequest | null> =>
    callIpc("agent_resume_breakpoint", { action, feedback }),
  getDagSnapshot: (): Promise<DagSnapshot | null> =>
    callIpc("agent_get_dag_snapshot"),
  getContext: (): Promise<AgentContext | null> => callIpc("agent_get_context"),
  getBlackboard: (): Promise<Blackboard | null> =>
    callIpc("agent_get_blackboard"),
  rollbackScript: (version: number): Promise<boolean> =>
    callIpc("agent_rollback_script", { version }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// batch · 批处理任务队列 (P2-1)
// ─────────────────────────────────────────────────────────────────────────

export const batchIpc = {
  createJob: (
    payload: string,
    jobType: BatchJobType,
    projectId?: string | null,
    priority?: number | null,
    bundlePath?: string | null,
  ): Promise<BatchJob> =>
    callIpc("batch_create_job", {
      payload,
      jobType,
      projectId: projectId ?? null,
      priority: priority ?? null,
      bundlePath: bundlePath ?? null,
    }),
  listJobs: (
    status?: BatchJobStatus | null,
    projectId?: string | null,
    limit?: number | null,
    bundlePath?: string | null,
  ): Promise<BatchJob[]> =>
    callIpc("batch_list_jobs", {
      status: status ?? null,
      projectId: projectId ?? null,
      limit: limit ?? null,
      bundlePath: bundlePath ?? null,
    }),
  getJob: (
    id: string,
    bundlePath?: string | null,
  ): Promise<BatchJob | null> =>
    callIpc("batch_get_job", { id, bundlePath: bundlePath ?? null }),
  cancelJob: (
    id: string,
    bundlePath?: string | null,
  ): Promise<void> =>
    callIpc("batch_cancel_job", { id, bundlePath: bundlePath ?? null }),
} as const;

// ─────────────────────────────────────────────────────────────────────────
// compute · 局域网/私有 GPU 算力节点 (P2-3)
// ─────────────────────────────────────────────────────────────────────────

export const computeIpc = {
  checkHealth: (config: ComputeNodeConfig): Promise<ComputeHealth> =>
    callIpc("compute_check_health", { config }),
} as const;

export const ipc = {
  app: appIpc,
  project: projectIpc,
  pipeline: pipelineIpc,
  settings: settingsIpc,
  update: updateIpc,
  assets: assetsIpc,
  export: exportIpc,
  video: videoIpc,
  help: helpIpc,
  theme: themeIpc,
  voice: voiceIpc,
  script: scriptIpc,
  detect: detectIpc,
  subtitle: subtitleIpc,
  agent: agentIpc,
  batch: batchIpc,
  compute: computeIpc,
} as const;

export type IpcFacade = typeof ipc;
