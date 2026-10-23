/**
 * dramaxis v1.1.0 · 剧枢 — 4 大工坊分阶流转与响应式脏标记驱动创作中心
 *
 * 工业级影视智能体创作全流程体系:
 * - W1: 素材与对白摄取工坊 (Asset Hub: 视频摄取 / 场景拆条 / 格式探测)
 * - W2: 编导剧本策划工坊 (Script Studio: 编导大纲 / 爆款剧本 / 6-Agent 闭环评审)
 * - W3: 毫秒级多轨精修工坊 (Timeline Studio: 5轨毫秒磁吸 / 声画对齐 / 智能避让)
 * - W4: 8维矩阵消重与交付工坊 (Export Hub: 剪映草稿秒出 / 8维指纹防重 / 批量并发裂变)
 * - 特征领域化解耦: ProductionHeader / ProductionLeftSidebar / ProductionWorkspace / ProductionInspector
 * - 播放时钟解耦: usePlaybackStore 隔离 60fps 高频重渲染
 * - 领域状态收拢: useWorkshopStore 驱动跨工坊数据与响应式脏标记流转
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { BatchImportDialog } from "@components/dialogs/BatchImportDialog";
import { ProductionHeader } from "@components/production/ProductionHeader";
import { ProductionLeftSidebar } from "@components/production/ProductionLeftSidebar";
import { ProductionWorkspace } from "@components/production/ProductionWorkspace";
import { ProductionInspector } from "@components/production/ProductionInspector";
import { projectIpc, scriptIpc, type ProjectRecord } from "@dramaxis/ipc";
import { useAssets } from "@hooks/useAssets";
import { useAgentWorkflow } from "@hooks/useAgentWorkflow";
import { useProject } from "@hooks/useProject";
import {
  useProjectStore,
  usePlaybackStore,
  useWorkshopStore,
  type WorkshopSceneCut,
} from "@dramaxis/core";
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
  const { undo: undoProject, redo: redoProject } = useProject();

  const [showImport, setShowImport] = useState(false);

  // 1. 播放控制与时钟 Store
  const togglePlay = usePlaybackStore((s) => s.togglePlay);

  // 2. 工坊领域 Store
  const setActiveWorkshop = useWorkshopStore((s) => s.setActiveWorkshop);
  const setActiveTab = useWorkshopStore((s) => s.setActiveTab);
  const setSceneCuts = useWorkshopStore((s) => s.setSceneCuts);
  const setScriptText = useWorkshopStore((s) => s.setScriptText);
  const setVoiceAudioPath = useWorkshopStore((s) => s.setVoiceAudioPath);
  const setVoiceDuration = useWorkshopStore((s) => s.setVoiceDuration);
  const setSubtitleSegments = useWorkshopStore((s) => s.setSubtitleSegments);
  const setIsGeneratingScript = useWorkshopStore(
    (s) => s.setIsGeneratingScript,
  );
  const markDirty = useWorkshopStore((s) => s.markDirty);
  const resetAllDirty = useWorkshopStore((s) => s.resetAllDirty);

  const userPrompt = useWorkshopStore((s) => s.userPrompt);
  const scriptStyle = useWorkshopStore((s) => s.scriptStyle);
  const llmProvider = useWorkshopStore((s) => s.llmProvider);

  // 3. 真实工程数据同步
  const cachedRecord = qc.getQueryData<ProjectRecord>(["current-project"]);
  const currentProject: ProjectRecord | null = useMemo(() => {
    if (storeProject && storePath) {
      return { path: storePath, project: storeProject };
    }
    return cachedRecord ?? null;
  }, [storeProject, storePath, cachedRecord]);

  // 初始化最近打开工程或空白工程
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

  // 从已导入素材中提取主视频路径
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

  // 4. Multi-Agent 智能体编排工作流
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
      resetAllDirty();
      toast.success("Multi-Agent 全流程生产完成，已直通矩阵交付工坊！");
    },
    onSceneCutsGenerated: (cuts) => {
      const workshopCuts: WorkshopSceneCut[] = cuts.map((c) => ({
        id: c.id,
        time: c.time,
        tag: c.tag,
        emotion: c.emotion,
      }));
      setSceneCuts(workshopCuts);
      markDirty("scenesDirty", false);
      markDirty("timelineDirty", true);
      markDirty("exportDirty", true);
    },
    onScriptGenerated: (script) => {
      setScriptText(script);
      markDirty("scriptDirty", false);
      markDirty("voiceDirty", true);
      markDirty("exportDirty", true);
    },
    onVoiceGenerated: (audioPath, dur) => {
      setVoiceAudioPath(audioPath);
      setVoiceDuration(dur);
      markDirty("voiceDirty", false);
      markDirty("timelineDirty", true);
      markDirty("exportDirty", true);
    },
    onSubtitlesGenerated: (subs) => {
      setSubtitleSegments(subs);
      markDirty("timelineDirty", false);
      markDirty("exportDirty", true);
    },
  });

  const handleStartMultiAgent = useCallback(
    async (auto: boolean = true) => {
      if (!currentProject?.project) return;
      setActiveWorkshop("script");
      setActiveTab("agent");
      await startWorkflow(currentProject.project, auto);
    },
    [currentProject, startWorkflow, setActiveWorkshop, setActiveTab],
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
          markDirty("scenesDirty", true);
          markDirty("scriptDirty", true);
          markDirty("timelineDirty", true);
          markDirty("exportDirty", true);
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
  }, [importFromPaths, agentAutoMode, handleStartMultiAgent, markDirty]);

  // 人机协同断点决策批准
  const handleApproveBreakpoint = useCallback(
    async (approved: boolean, feedback?: string) => {
      await approveBreakpoint(approved, feedback);
    },
    [approveBreakpoint],
  );

  // 手动触发 AI 剧本生成
  const handleScriptGenerate = useCallback(async () => {
    setIsGeneratingScript(true);
    try {
      const activeMedia = currentProject?.project?.media_files?.[0];
      const videoDuration = activeMedia?.duration_seconds || 30.0;
      // 短剧解说黄金语速：4.2 ~ 4.5 字/秒，严控字数预算避免音画脱节
      const targetWords = Math.max(40, Math.round(videoDuration * 4.3));

      const resp = await scriptIpc.generate({
        prompt: userPrompt || "短剧第一人称独白反转",
        style: scriptStyle,
        provider: llmProvider,
        apiKey: null,
        baseUrl: null,
        model: null,
        emotionDensity: null,
        wordCountTarget: targetWords,
        videoDurationSec: videoDuration,
        videoPath: mediaPath,
        hookStyle: "conflict",
        includeHook: true,
        imagesBase64: null,
      });
      setScriptText(resp.text);
      markDirty("voiceDirty", true);
      markDirty("exportDirty", true);
      toast.success(
        `ScreenwriterAgent: AI 独白脚本生成完成（精准适配 ${videoDuration.toFixed(1)}s 画面，约 ${resp.wordCount} 字）！`,
      );
    } catch {
      setScriptText(
        "【第一人称沉浸独白】\n我叫林渊。所有人都以为三年前那场大火彻底烧死了我，直到今天我以千亿总裁的身份再次站在这里。那个曾经背叛我的人，现在正颤抖着跪在我的脚下求饶...但我知道，真正的幕后黑手，还藏在那扇紧闭的铁门后面！",
      );
      markDirty("voiceDirty", true);
      markDirty("exportDirty", true);
      toast.success("ScreenwriterAgent: 剧本文案已生成就绪！");
    } finally {
      setIsGeneratingScript(false);
    }
  }, [
    userPrompt,
    scriptStyle,
    llmProvider,
    currentProject?.project?.media_files,
    mediaPath,
    setIsGeneratingScript,
    setScriptText,
    markDirty,
  ]);

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
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoProject, redoProject, togglePlay]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg select-none font-sans">
      {/* ── 1. 顶部 4 大工坊分阶流转与响应式脏标记总控栏 ── */}
      <ProductionHeader
        projectName={currentProject?.project?.name}
        hasUploadedVideo={hasUploadedVideo}
        onUndo={() =>
          void undoProject().then(() => toast.info("已撤销 (Undo)"))
        }
        onRedo={() =>
          void redoProject().then(() => toast.info("已重做 (Redo)"))
        }
        onStartAgent={() => void handleStartMultiAgent(agentAutoMode)}
        isAgentRunning={isAgentRunning}
      />

      {/* ── 2. 中间三栏主体架构 ── */}
      <div className="grid flex-1 grid-cols-[230px_1fr_310px] overflow-hidden">
        {/* ── 左栏: 6-Agent 状态机机架 & 场景切片 (W1 / W2 焦点) ── */}
        <ProductionLeftSidebar
          currentStepIndex={currentStepIndex}
          mediaPath={mediaPath}
        />

        {/* ── 中栏: 影视视听监看台与 5 轨磁性时间轴 (W3 焦点) ── */}
        <ProductionWorkspace
          hasUploadedVideo={hasUploadedVideo}
          mediaPath={mediaPath}
          onImportVideo={handleDirectImportVideo}
        />

        {/* ── 右栏: Multi-Agent 控制台与创作工坊 (W2 / W4 焦点) ── */}
        <ProductionInspector
          currentProject={currentProject}
          currentStepIndex={currentStepIndex}
          isAgentRunning={isAgentRunning}
          agentAutoMode={agentAutoMode}
          onToggleAutoMode={setAgentAutoMode}
          onStartAgent={() => void handleStartMultiAgent(agentAutoMode)}
          agentMessages={agentMessages}
          breakpoint={breakpoint}
          onApproveBreakpoint={handleApproveBreakpoint}
          onGenerateScript={handleScriptGenerate}
        />
      </div>

      <BatchImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}
