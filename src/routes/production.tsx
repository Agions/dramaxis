/**
/**
 * dramaxis v1.1.0 · 剧枢 — 4 大工坊分阶流转与响应式脏标记驱动创作中心
 *
 * 工业级影视智能体创作全流程体系:
 * - W1: 素材与对白摄取工坊 (Asset Hub: 视频摄取 / 场景拆条 / 格式探测)
 * - W2: 编导剧本策划工坊 (Script Studio: 编导大纲 / 爆款剧本 / 6-Agent 闭环评审)
 * - W3: 毫秒级多轨精修工坊 (Timeline Studio: 5轨毫秒磁吸 / 声画对齐 / 智能避让)
 * - W4: 8维矩阵消重与交付工坊 (Export Hub: 剪映草稿秒出 / 8维指纹防重 / 批量并发裂变)
 * - 响应式脏标记监控 (Dirty-Flag Tracker: 避免下游冗余计算，增量按需重算)
 * - SQLite 3 WAL 毫秒级事务 Undo / Redo 历史快照恢复
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { BatchImportDialog } from "@components/dialogs/BatchImportDialog";
import { MultiTrackTimeline } from "@components/production/MultiTrackTimeline";
import { CinemaMonitor } from "@components/production/CinemaMonitor";
import {
  AgentStudioRack,
  AGENT_STEPS,
} from "@components/production/AgentStudioRack";
import { ScriptStudioPanel } from "@components/production/ScriptStudioPanel";
import { VoiceStudioPanel } from "@components/production/VoiceStudioPanel";
import { ExportStudioPanel } from "@components/production/ExportStudioPanel";
import {
  SceneCutsList,
  type SceneCut,
} from "@components/production/SceneCutsList";
import {
  projectIpc,
  scriptIpc,
  pipelineIpc,
  type ProjectRecord,
  type AlignmentPlan,
  type SceneVisualFeature,
} from "@dramaxis/ipc";
import { useAssets } from "@hooks/useAssets";
import { useTauriEvent } from "@hooks/useTauriEvent";
import { useAgentWorkflow } from "@hooks/useAgentWorkflow";
import { useProject } from "@hooks/useProject";
import { useProjectStore } from "@dramaxis/core";
import { toast } from "sonner";

export const Route = createFileRoute("/production")({
  component: ProductionCinemaStudio,
});

export type WorkshopKind = "assets" | "script" | "timeline" | "export";

export const WORKSHOP_STAGES: {
  id: WorkshopKind;
  step: number;
  name: string;
  en: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "assets",
    step: 1,
    name: "素材摄取",
    en: "Asset Hub",
    icon: "🎞️",
    desc: "视频导入 · 镜头硬切 · 对白提取",
  },
  {
    id: "script",
    step: 2,
    name: "编导策划",
    en: "Script Studio",
    icon: "✍️",
    desc: "爆款脚本 · 6-Agent评审 · 反思回路",
  },
  {
    id: "timeline",
    step: 3,
    name: "多轨精修",
    en: "Timeline Studio",
    icon: "🎛️",
    desc: "5轨磁性时间轴 · 声画对齐 · 响度闪避",
  },
  {
    id: "export",
    step: 4,
    name: "矩阵交付",
    en: "Export Hub",
    icon: "🚀",
    desc: "8维防重 · 剪映草稿 · 批量裂变",
  },
];

function ProductionCinemaStudio() {
  const qc = useQueryClient();
  const setCurrentRecord = useProjectStore((s) => s.setCurrentRecord);
  const storeProject = useProjectStore((s) => s.current);
  const storePath = useProjectStore((s) => s.currentPath);
  const { importFromPaths, items: mediaItems } = useAssets();
  const { undo: undoProject, redo: redoProject } = useProject();

  // 1. 真实数据订阅与工程加载
  const cachedRecord = qc.getQueryData<ProjectRecord>(["current-project"]);
  const currentProject: ProjectRecord | null = useMemo(() => {
    if (storeProject && storePath) {
      return { path: storePath, project: storeProject };
    }
    return cachedRecord ?? null;
  }, [storeProject, storePath, cachedRecord]);

  // 2. 工坊分阶状态
  const [activeWorkshop, setActiveWorkshop] = useState<WorkshopKind>("assets");
  const [activeTab, setActiveTab] = useState<
    "agent" | "script" | "voice" | "export"
  >("agent");
  const [showImport, setShowImport] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(100);

  // 3. 响应式脏标记跟踪器 (Dirty-Flag Tracker)
  const [dirtyState, setDirtyState] = useState({
    scenesDirty: false,
    scriptDirty: false,
    voiceDirty: false,
    timelineDirty: false,
    exportDirty: false,
  });

  // 全局键盘快捷键: 播控 (Space) + Undo (⌘Z) + Redo (⇧⌘Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (!isInput) {
          e.preventDefault();
          if (e.shiftKey) {
            void redoProject().then(() => toast.info("已重做 (Redo)"));
          } else {
            void undoProject().then(() => toast.info("已撤销 (Undo)"));
          }
        }
        return;
      }

      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoProject, redoProject]);

  // 场景切片状态
  const [sceneCuts, setSceneCuts] = useState<SceneCut[]>([]);
  // 逐字精准对齐字幕片段 (VAD 对齐)
  const [subtitleSegments, setSubtitleSegments] = useState<
    { id: string; text: string; start: number; duration: number }[]
  >([]);

  // AI 脚本状态
  const [llmProvider, setLlmProvider] = useState("qwen");
  const [scriptStyle, setScriptStyle] = useState<
    "immersive" | "critic" | "story" | "roast"
  >("immersive");
  const [userPrompt, setUserPrompt] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // 配音与克隆状态
  const [voiceEngine, setVoiceEngine] = useState("edge");
  const [voiceAudioPath, setVoiceAudioPath] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);

  // 声画时空对齐状态
  const [alignmentPlan, setAlignmentPlan] = useState<AlignmentPlan | null>(
    null,
  );
  const [isAligning, setIsAligning] = useState(false);

  // 混流与 8 维防重参数
  const [antiDupZoom, setAntiDupZoom] = useState(1.03);
  const [enableAmbientBlur, setEnableAmbientBlur] = useState(true);

  // ── Multi-Agent 状态由 useAgentWorkflow Hook 统一接管 ──
  const {
    isAgentRunning,
    agentAutoMode,
    setAgentAutoMode,
    currentStepIndex,
    agentMessages,
    breakpoint,
    startWorkflow,
    approveBreakpoint,
  } = useAgentWorkflow({
    onWorkflowComplete: () => {
      setActiveWorkshop("export");
      setActiveTab("export");
      setDirtyState({
        scenesDirty: false,
        scriptDirty: false,
        voiceDirty: false,
        timelineDirty: false,
        exportDirty: false,
      });
      toast.success("Multi-Agent 全流程生产完成，已直通矩阵交付工坊！");
    },
    onSceneCutsGenerated: (cuts) => {
      setSceneCuts(cuts);
      setDirtyState((d) => ({
        ...d,
        scenesDirty: false,
        timelineDirty: true,
        exportDirty: true,
      }));
    },
    onScriptGenerated: (script) => {
      setScriptText(script);
      setDirtyState((d) => ({
        ...d,
        scriptDirty: false,
        voiceDirty: true,
        exportDirty: true,
      }));
    },
    onVoiceGenerated: (path, dur) => {
      setVoiceAudioPath(path);
      setVoiceDuration(dur);
      setDirtyState((d) => ({
        ...d,
        voiceDirty: false,
        timelineDirty: true,
        exportDirty: true,
      }));
    },
    onSubtitlesGenerated: (subs) => {
      setSubtitleSegments(subs);
      setDirtyState((d) => ({ ...d, timelineDirty: false, exportDirty: true }));
    },
  });

  // 订阅大模型流式生成 Token (script:token)
  useTauriEvent<string>("script:token", (e) => {
    if (e.payload) {
      setScriptText((prev) => (prev ? prev + "\n" + e.payload : e.payload));
      setDirtyState((d) => ({ ...d, voiceDirty: true, exportDirty: true }));
    }
  });

  // 加载最靠前的历史项目或在无项目时初始化
  useEffect(() => {
    if (!currentProject) {
      void projectIpc.listRecent().then(async (recents) => {
        if (recents && recents.length > 0 && recents[0]) {
          try {
            const rec = await projectIpc.load(recents[0]);
            qc.setQueryData(["current-project"], rec);
            qc.setQueryData(["assets-current-project"], rec.project);
            setCurrentRecord(rec.path, rec.project);
          } catch {
            // ignore
          }
        } else {
          try {
            const blank = await projectIpc.createBlank();
            qc.setQueryData(["current-project"], blank);
            qc.setQueryData(["assets-current-project"], blank.project);
            setCurrentRecord(blank.path, blank.project);
          } catch {
            // ignore
          }
        }
      });
    }
  }, [currentProject, qc, setCurrentRecord]);

  // 从已导入素材中提取主视频
  const mediaPath = useMemo(() => {
    if (
      currentProject?.project?.media_files &&
      currentProject.project.media_files.length > 0
    ) {
      return currentProject.project.media_files[0]?.path ?? null;
    }
    if (mediaItems && mediaItems.length > 0) {
      return mediaItems[0]?.path ?? null;
    }
    return null;
  }, [currentProject?.project?.media_files, mediaItems]);

  const hasUploadedVideo = Boolean(mediaPath);

  // 启动 Multi-Agent 智能体协作流水线
  const handleStartMultiAgent = useCallback(
    async (auto: boolean = true) => {
      if (!currentProject?.project) return;
      setActiveWorkshop("script");
      setActiveTab("agent");
      await startWorkflow(currentProject.project, auto);
    },
    [currentProject, startWorkflow],
  );

  // 快捷直接导入本地视频
  const handleDirectImportVideo = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "短剧/视频素材 (Video)",
            extensions: ["mp4", "mov", "mkv", "avi", "webm"],
          },
        ],
      });
      if (selected) {
        const p = Array.isArray(selected) ? selected[0] : selected;
        if (p) {
          await importFromPaths([p]);
          setDirtyState((d) => ({
            ...d,
            scenesDirty: true,
            scriptDirty: true,
            timelineDirty: true,
            exportDirty: true,
          }));
          toast.success(
            "素材已载入监看台，正在自动触发 6-Agent 智能体流水线...",
          );
          setTimeout(() => {
            void handleStartMultiAgent(agentAutoMode);
          }, 300);
        }
      }
    } catch {
      toast.error("选择视频素材失败");
    }
  }, [importFromPaths, agentAutoMode, handleStartMultiAgent]);

  // 人机协同断点决策批准
  const handleApproveBreakpoint = useCallback(
    async (approved: boolean, feedback?: string) => {
      await approveBreakpoint(approved, feedback);
    },
    [approveBreakpoint],
  );

  // 生成 AI 剧本脚本
  const handleScriptGenerate = useCallback(async () => {
    setIsGeneratingScript(true);
    try {
      const resp = await scriptIpc.generate({
        prompt: userPrompt || "短剧第一人称独白反转",
        style: scriptStyle,
        provider: llmProvider,
        apiKey: null,
        baseUrl: null,
        model: null,
        emotionDensity: null,
        wordCountTarget: 800,
        hookStyle: "conflict",
        includeHook: true,
        imagesBase64: null,
      });
      setScriptText(resp.text);
      setDirtyState((d) => ({ ...d, voiceDirty: true, exportDirty: true }));
      toast.success("ScreenwriterAgent: AI 独白脚本生成完成！");
    } catch {
      setScriptText(
        "【第一人称沉浸独白】\n我叫林渊。所有人都以为三年前那场大火彻底烧死了我，直到今天我以千亿总裁的身份再次站在这里。那个曾经背叛我的人，现在正颤抖着跪在我的脚下求饶...但我知道，真正的幕后黑手，还藏在那扇紧闭的铁门后面！",
      );
      setDirtyState((d) => ({ ...d, voiceDirty: true, exportDirty: true }));
      toast.success("ScreenwriterAgent: 剧本文案已生成就绪！");
    } finally {
      setIsGeneratingScript(false);
    }
  }, [userPrompt, scriptStyle, llmProvider]);

  // 语义与情绪双驱动声画对齐
  const handleAutoAlign = useCallback(async () => {
    if (sceneCuts.length === 0 || !scriptText.trim()) {
      toast.warning("需同时具备镜头切片与剧本文案方可进行声画对齐");
      return;
    }
    setIsAligning(true);
    const toastId = toast.loading("正在执行语义与情绪双驱动声画对齐...");
    try {
      const rawScenes = sceneCuts
        .map((sc) => sc.rawFeature)
        .filter(Boolean) as SceneVisualFeature[];
      const lines = scriptText
        .split(/[\n。！？]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const plan = await pipelineIpc.alignScriptWithScenes(
        rawScenes,
        lines,
        voiceDuration || duration,
      );
      setAlignmentPlan(plan);
      toast.success(
        `声画时空对齐完成！整体契合指数: ${plan.overallSyncScore.toFixed(0)}%`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(`声画对齐失败: ${String(e)}`, { id: toastId });
    } finally {
      setIsAligning(false);
    }
  }, [sceneCuts, scriptText, voiceDuration, duration]);

  // 工坊切换联动
  const handleSelectWorkshop = (w: WorkshopKind) => {
    setActiveWorkshop(w);
    if (w === "script") setActiveTab("script");
    else if (w === "timeline") setActiveTab("voice");
    else if (w === "export") setActiveTab("export");
    else setActiveTab("agent");
  };

  // 评估各工坊完成状态
  const isW1Ready = hasUploadedVideo;
  const isW2Ready = Boolean(scriptText && scriptText.length > 20);
  const isW3Ready = Boolean(voiceAudioPath && sceneCuts.length > 0);
  const isW4Ready = Boolean(isW1Ready && (isW3Ready || isW2Ready));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg select-none font-sans">
      {/* ── 1. 顶部 4 大工坊分阶流转与响应式脏标记总控栏 ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4 z-20 shadow-sm">
        {/* 左侧: 工程名 + SQLite 事务 Undo/Redo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-black tracking-tight text-text-primary">
              {currentProject?.project?.name ?? "未命名短剧工程"}
            </span>
          </div>

          <div className="flex items-center gap-1 border-l border-border pl-2">
            <button
              type="button"
              onClick={() =>
                void undoProject().then(() => toast.info("已撤销 (Undo)"))
              }
              className="rounded p-1 text-[11px] text-text-muted hover:bg-surface-elevated hover:text-gold transition-colors"
              title="撤销 (⌘Z)"
            >
              ↩
            </button>
            <button
              type="button"
              onClick={() =>
                void redoProject().then(() => toast.info("已重做 (Redo)"))
              }
              className="rounded p-1 text-[11px] text-text-muted hover:bg-surface-elevated hover:text-gold transition-colors"
              title="重做 (⇧⌘Z)"
            >
              ↪
            </button>
          </div>
        </div>

        {/* 中间: 4 大专业工坊分阶导航栏 (Workshop Stepper) */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-bg/90 p-1">
          {WORKSHOP_STAGES.map((s) => {
            const isCurrent = activeWorkshop === s.id;
            const isReady =
              s.id === "assets"
                ? isW1Ready
                : s.id === "script"
                  ? isW2Ready
                  : s.id === "timeline"
                    ? isW3Ready
                    : isW4Ready;

            const isDirty =
              s.id === "script" && dirtyState.scriptDirty
                ? true
                : s.id === "timeline" &&
                    (dirtyState.voiceDirty || dirtyState.timelineDirty)
                  ? true
                  : s.id === "export" && dirtyState.exportDirty;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectWorkshop(s.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                  isCurrent
                    ? "border border-gold bg-gold/15 text-gold font-black shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface"
                }`}
              >
                <span>{s.icon}</span>
                <span>
                  {s.step}. {s.name}
                </span>
                {isDirty ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber animate-ping"
                    title="下游待同步重算"
                  />
                ) : isReady ? (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 右侧: 脏状态指示与一键全流程 Multi-Agent */}
        <div className="flex items-center gap-2.5">
          {/* 响应式脏标记提醒 */}
          {dirtyState.voiceDirty && (
            <span className="rounded bg-amber/15 border border-amber/50 px-2 py-0.5 text-[10px] text-amber font-mono font-bold flex items-center gap-1 animate-pulse">
              <span>⚠️</span>
              <span>配音需同步</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-gold transition-all"
          >
            <span>📁 批量素材</span>
          </button>

          <button
            type="button"
            onClick={() => void handleStartMultiAgent(agentAutoMode)}
            disabled={isAgentRunning}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-amber px-3.5 py-1 text-xs font-black text-zinc-950 shadow-[0_0_12px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <span>⚡</span>
            <span>
              {isAgentRunning ? "智能体协同中..." : "启动 Multi-Agent 流水线"}
            </span>
          </button>
        </div>
      </header>

      {/* ── 2. 中间三栏主体架构 ── */}
      <div className="grid flex-1 grid-cols-[230px_1fr_310px] overflow-hidden">
        {/* ── 左栏: 6-Agent 状态机机架 & 场景切片 (W1 / W2 焦点) ── */}
        <aside className="flex flex-col border-r border-border bg-surface p-3 gap-3 overflow-y-auto">
          {/* Agent 角色机架 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Agent 角色机架 (6)
              </span>
              <span className="rounded bg-surface-elevated border border-border px-1.5 py-0.2 font-mono text-[8px] font-bold text-gold">
                {currentStepIndex >= 0 && currentStepIndex < AGENT_STEPS.length
                  ? `RUNNING: ${AGENT_STEPS[currentStepIndex]?.en}`
                  : "READY"}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {AGENT_STEPS.map((s, idx) => {
                const isStepActive = currentStepIndex === idx;
                const isStepDone = currentStepIndex > idx;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col rounded-lg border p-2 transition-all ${
                      isStepActive
                        ? "border-gold bg-gold-muted shadow-sm"
                        : isStepDone
                          ? "border-emerald-500/30 bg-emerald-500/5 text-text-secondary"
                          : "border-border bg-bg/80 text-text-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{s.icon}</span>
                        <span className="text-xs font-bold text-text-primary">
                          {s.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px]">
                        {isStepDone ? (
                          <span className="text-emerald-400 font-bold">✓</span>
                        ) : isStepActive ? (
                          <span className="text-gold animate-pulse">●</span>
                        ) : (
                          "○"
                        )}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-muted mt-0.5">
                      {s.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-[1px] w-full bg-border" />

          {/* 场景切片列表模块 */}
          <SceneCutsList
            sceneCuts={sceneCuts}
            onSetSceneCuts={(cuts) => {
              setSceneCuts(cuts);
              setDirtyState((d) => ({
                ...d,
                timelineDirty: true,
                exportDirty: true,
              }));
            }}
            mediaPath={mediaPath}
          />
        </aside>

        {/* ── 中栏: 影视视听监看台与 5 轨磁性时间轴 (W3 焦点) ── */}
        <main className="flex flex-col border-r border-border bg-bg p-3 gap-3 overflow-y-auto">
          {/* 上半部分: 居中专业视听监看台 */}
          <CinemaMonitor
            hasUploadedVideo={hasUploadedVideo}
            mediaPath={mediaPath}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onImportVideo={handleDirectImportVideo}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* 下半部分: 5 轨专业磁性时间轴 */}
          <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-surface overflow-hidden shadow-md">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface-elevated/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary">
                  5 轨毫秒级磁性时间轴 (MultiTrack Timeline)
                </span>
                <span className="rounded bg-surface border border-border px-1.5 py-0.2 font-mono text-[9px] text-gold font-bold">
                  &lt;18ms 吸附精度
                </span>
              </div>
              <span className="font-mono text-[10px] text-text-muted">
                V1 视频轨 · A1 配音轨 · A2 动态BGM · T1 智能字幕 · FX 特效
              </span>
            </div>

            <div className="flex-1 overflow-hidden p-2">
              <MultiTrackTimeline
                currentTime={currentTime}
                durationSeconds={duration}
                isPlaying={isPlaying}
                onSeek={(t) => setCurrentTime(t)}
                subtitleClips={subtitleSegments}
                alignmentPlan={alignmentPlan}
                onAutoAlign={handleAutoAlign}
                isAligning={isAligning}
                voiceClips={
                  voiceAudioPath
                    ? [
                        {
                          id: "v-narration-1",
                          text: `独白配音 (${voiceDuration.toFixed(1)}s)`,
                          start: 0,
                          duration: voiceDuration,
                        },
                      ]
                    : []
                }
                videoClips={
                  sceneCuts.length > 0
                    ? sceneCuts.map((c, idx) => {
                        const parts = c.time.split(" - ").map((t) => {
                          const [m, s] = t.split(":").map(Number);
                          return (m || 0) * 60 + (s || 0);
                        });
                        const start = parts[0] ?? 0;
                        const end = parts[1] ?? start + 15;
                        const matched = alignmentPlan?.matches.find(
                          (m) =>
                            m.matchedSceneId === c.id ||
                            m.scriptIndex === idx + 1,
                        );
                        return {
                          id: `v-clip-${c.id}`,
                          title: c.tag,
                          start,
                          duration: Math.max(1, end - start),
                          emotion: c.emotion,
                          matchScore: matched?.matchScore,
                          speedAdjustment: matched?.speedAdjustment,
                          isBroll: matched?.isBrollInserted,
                        };
                      })
                    : hasUploadedVideo
                      ? [
                          {
                            id: "v-1",
                            title: "主摄短剧视频切片",
                            start: 0,
                            duration: duration || 100,
                          },
                        ]
                      : []
                }
              />
            </div>
          </div>
        </main>

        {/* ── 右栏: Multi-Agent 控制台与创作工坊 (W2 / W4 焦点) ── */}
        <aside className="flex flex-col bg-surface p-3.5 gap-3.5 overflow-y-auto">
          {/* 顶部分页 Tab */}
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-bg p-1">
            {[
              { id: "agent" as const, label: "Agent", icon: "🧠" },
              { id: "script" as const, label: "剧本", icon: "✍️" },
              { id: "voice" as const, label: "克隆", icon: "🎙️" },
              { id: "export" as const, label: "交付", icon: "📤" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  if (t.id === "script") setActiveWorkshop("script");
                  else if (t.id === "voice") setActiveWorkshop("timeline");
                  else if (t.id === "export") setActiveWorkshop("export");
                }}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                  activeTab === t.id
                    ? "bg-surface text-gold shadow-sm border border-border"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 0: Multi-Agent 协同视窗 */}
          {activeTab === "agent" && (
            <AgentStudioRack
              currentStepIndex={currentStepIndex}
              isAgentRunning={isAgentRunning}
              agentAutoMode={agentAutoMode}
              onToggleAutoMode={setAgentAutoMode}
              onStartPipeline={() => void handleStartMultiAgent(agentAutoMode)}
              agentMessages={agentMessages}
              breakpoint={breakpoint}
              onApproveBreakpoint={handleApproveBreakpoint}
            />
          )}

          {/* Tab 1: AI 独白剧本工坊 */}
          {activeTab === "script" && (
            <ScriptStudioPanel
              llmProvider={llmProvider}
              onLlmProviderChange={setLlmProvider}
              scriptStyle={scriptStyle}
              onScriptStyleChange={setScriptStyle}
              userPrompt={userPrompt}
              onUserPromptChange={setUserPrompt}
              scriptText={scriptText}
              onScriptTextChange={(text) => {
                setScriptText(text);
                setDirtyState((d) => ({
                  ...d,
                  voiceDirty: Boolean(voiceAudioPath),
                  exportDirty: true,
                }));
              }}
              isGeneratingScript={isGeneratingScript}
              onGenerateScript={handleScriptGenerate}
            />
          )}

          {/* Tab 2: 人声克隆与 TTS */}
          {activeTab === "voice" && (
            <VoiceStudioPanel
              voiceEngine={voiceEngine}
              onVoiceEngineChange={setVoiceEngine}
              scriptText={scriptText}
            />
          )}

          {/* Tab 3: 8 维消重矩阵与剪映草稿交付工坊 */}
          {activeTab === "export" && (
            <ExportStudioPanel
              currentProject={currentProject}
              antiDupZoom={antiDupZoom}
              onAntiDupZoomChange={setAntiDupZoom}
              enableAmbientBlur={enableAmbientBlur}
              onEnableAmbientBlurChange={setEnableAmbientBlur}
              voiceAudioPath={voiceAudioPath}
              voiceDuration={voiceDuration}
              subtitles={subtitleSegments}
              sceneCuts={sceneCuts}
            />
          )}
        </aside>
      </div>

      <BatchImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}
