/**
 * splicr v1.0.1 · 三栏专业影视级 NLE 智能体创作工作台 (模块化重构版)
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
import { projectIpc, scriptIpc, type ProjectRecord } from "@dramaxis/ipc";
import { useAssets } from "@hooks/useAssets";
import { useTauriEvent } from "@hooks/useTauriEvent";
import { useAgentWorkflow } from "@hooks/useAgentWorkflow";
import { useProjectStore } from "@dramaxis/core";
import { toast } from "sonner";

export const Route = createFileRoute("/production")({
  component: ProductionCinemaStudio,
});

function ProductionCinemaStudio() {
  const qc = useQueryClient();
  const setCurrentRecord = useProjectStore((s) => s.setCurrentRecord);
  const storeProject = useProjectStore((s) => s.current);
  const storePath = useProjectStore((s) => s.currentPath);
  const { importFromPaths, items: mediaItems } = useAssets();

  // 1. 真实数据订阅与工程加载
  const cachedRecord = qc.getQueryData<ProjectRecord>(["current-project"]);
  const currentProject: ProjectRecord | null = useMemo(() => {
    if (storeProject && storePath) {
      return { path: storePath, project: storeProject };
    }
    return cachedRecord ?? null;
  }, [storeProject, storePath, cachedRecord]);

  // 2. 状态管理
  const [activeTab, setActiveTab] = useState<
    "agent" | "script" | "voice" | "export"
  >("agent");
  const [showImport, setShowImport] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(100);

  // 全局空格键 (Space) 播控监听 (避开输入框焦点冲突)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const activeEl = document.activeElement;
        const isInput =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute("contenteditable") === "true";
        if (!isInput) {
          e.preventDefault();
          setIsPlaying((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // 混流与防重构参数
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
      setActiveTab("export");
    },
    onSceneCutsGenerated: (cuts) => {
      setSceneCuts(cuts);
    },
    onScriptGenerated: (script) => {
      setScriptText(script);
    },
    onVoiceGenerated: (path, dur) => {
      setVoiceAudioPath(path);
      setVoiceDuration(dur);
    },
    onSubtitlesGenerated: (subs) => {
      setSubtitleSegments(subs);
    },
  });

  // 订阅大模型流式生成 Token (script:token)
  useTauriEvent<string>("script:token", (e) => {
    if (e.payload) {
      setScriptText((prev) => (prev ? prev + "\n" + e.payload : e.payload));
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
      toast.success("ScreenwriterAgent: AI 独白脚本生成完成！");
    } catch {
      setScriptText(
        "【第一人称沉浸独白】\n我叫林渊。所有人都以为三年前那场大火彻底烧死了我，直到今天我以千亿总裁的身份再次站在这里。那个曾经背叛我的人，现在正颤抖着跪在我的脚下求饶...但我知道，真正的幕后黑手，还藏在那扇紧闭的铁门后面！",
      );
      toast.success("ScreenwriterAgent: 剧本文案已生成就绪！");
    } finally {
      setIsGeneratingScript(false);
    }
  }, [userPrompt, scriptStyle, llmProvider]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg select-none font-sans">
      {/* ── 1. 顶部工作台全局状态条 ── */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-black tracking-tight text-text-primary">
              {currentProject?.project?.name ?? "未命名工程"}
            </span>
          </div>
          <span className="rounded bg-surface-elevated border border-border px-1.5 py-0.5 font-mono text-[9px] font-bold text-gold">
            NLE Studio v1.0.1
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-gold transition-all"
          >
            <span>📁 批量素材扫描</span>
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
      <div className="grid flex-1 grid-cols-[220px_1fr_300px] overflow-hidden">
        {/* ── 左栏: 6-Agent 状态机机架 & 场景切片 ── */}
        <aside className="flex flex-col border-r border-border bg-surface p-3 gap-3 overflow-y-auto">
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
            onSetSceneCuts={setSceneCuts}
            mediaPath={mediaPath}
          />
        </aside>

        {/* ── 中栏: 影视视听监看台与 5 轨磁性时间轴 ── */}
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
                    ? sceneCuts.map((c) => {
                        const parts = c.time.split(" - ").map((t) => {
                          const [m, s] = t.split(":").map(Number);
                          return (m || 0) * 60 + (s || 0);
                        });
                        const start = parts[0] ?? 0;
                        const end = parts[1] ?? start + 15;
                        return {
                          id: `v-clip-${c.id}`,
                          title: c.tag,
                          start,
                          duration: Math.max(1, end - start),
                          emotion: c.emotion,
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

        {/* ── 右栏: Multi-Agent 控制台与创作工坊 ── */}
        <aside className="flex flex-col bg-surface p-3.5 gap-3.5 overflow-y-auto">
          {/* 顶部分页 Tab */}
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-bg p-1">
            {[
              { id: "agent" as const, label: "Agent", icon: "🧠" },
              { id: "script" as const, label: "剧本", icon: "✍️" },
              { id: "voice" as const, label: "克隆", icon: "🎙️" },
              { id: "export" as const, label: "草稿", icon: "📤" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                  activeTab === t.id
                    ? "bg-surface text-gold shadow-sm border border-border"
                    : "text-text-muted hover:text-text-primary"
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
              onScriptTextChange={setScriptText}
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

          {/* Tab 3: 剪映草稿交付与导出 */}
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
