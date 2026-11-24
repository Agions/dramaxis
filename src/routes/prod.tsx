/**
 * dramaxis v1.3.0 · 剧枢 — 4 大工坊分阶流转与响应式创作中心 (声明式总装路由)
 *
 * 工业级影视智能体创作全流程体系:
 * - W1: 素材与对白摄取工坊 (Asset Hub: 视频摄取 / 场景拆条 / 格式探测)
 * - W2: 编导剧本策划工坊 (Script Studio: 编导大纲 / 爆款剧本 / 6-Agent 闭环评审)
 * - W3: 毫秒级多轨精修工坊 (Timeline Studio: 5轨毫秒磁吸 / 声画对齐 / 智能避让)
 * - W4: 多平台母带定制与交付工坊 (Export Hub: 剪映草稿直出 / 多平台母带定制 / 批量导出)
 * - 纯声明式架构: 会话数据与快捷键下沉至 useProductionSession
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BatchImportDialog } from "@components/dialogs/import";
import { ProductionHeader } from "@components/prod/header";
import { ProductionLeftSidebar } from "@components/prod/side";
import { ProductionWorkspace } from "@components/prod/work";
import { ProductionInspector } from "@components/prod/inspect";
import { useProductionSession } from "@hooks/session";

type StudioFocusMode = "balanced" | "script" | "timeline";

const DEFAULT_LEFT_WIDTH = 230;
const DEFAULT_RIGHT_WIDTH = 310;

export const Route = createFileRoute("/prod")({
  component: ProductionCinemaStudio,
});

function ProductionCinemaStudio() {
  const {
    currentProject,
    hasUploadedVideo,
    mediaPath,
    mediaDuration,
    showImport,
    setShowImport,
    isAgentRunning,
    agentAutoMode,
    setAgentAutoMode,
    currentStepIndex,
    dagSnapshot,
    workflowProfile,
    agentMessages,
    breakpoint,
    blackboard,
    undoProject,
    redoProject,
    handleStartMultiAgent,
    handleDirectImportVideo,
    handleApproveBreakpoint,
    handleScriptGenerate,
  } = useProductionSession();

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [focusMode, setFocusMode] = useState<StudioFocusMode>("balanced");
  const dragSideRef = useRef<"left" | "right" | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragSideRef.current === "left") {
      setLeftWidth(Math.min(380, Math.max(180, e.clientX)));
    } else if (dragSideRef.current === "right") {
      setRightWidth(Math.min(480, Math.max(260, window.innerWidth - e.clientX)));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragSideRef.current = null;
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startResize = (side: "left" | "right") => {
    dragSideRef.current = side;
    document.body.style.cursor = "col-resize";
  };

  const applyFocusMode = (mode: StudioFocusMode) => {
    setFocusMode(mode);
    if (mode === "balanced") {
      setLeftWidth(DEFAULT_LEFT_WIDTH);
      setRightWidth(DEFAULT_RIGHT_WIDTH);
    } else if (mode === "script") {
      setLeftWidth(190);
      setRightWidth(440);
    } else if (mode === "timeline") {
      setLeftWidth(190);
      setRightWidth(260);
    }
  };

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

      {/* ── 1b. 轻量布局聚焦模式切换条 (P1-3) ── */}
      <div className="flex items-center justify-end gap-1.5 border-b border-border/50 bg-surface/40 px-3 py-1 text-[11px] text-text-muted">
        <span className="mr-1 opacity-75">布局模式:</span>
        {(
          [
            ["balanced", "三栏标准"],
            ["script", "剧本聚焦"],
            ["timeline", "精剪聚焦"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => applyFocusMode(mode)}
            className={`rounded px-2 py-0.5 transition-colors ${
              focusMode === mode
                ? "bg-accent/20 text-accent font-medium"
                : "hover:bg-surface-hover text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 2. 中间可拖拽三栏主体架构 (P1-3) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── 左栏: Multi-Agent 动态 DAG 机架 & 场景切片 ── */}
        <div style={{ width: leftWidth }} className="shrink-0 overflow-hidden">
          <ProductionLeftSidebar
            currentStepIndex={currentStepIndex}
            mediaPath={mediaPath}
            workflowProfile={workflowProfile}
            dagSnapshot={dagSnapshot}
            isAgentRunning={isAgentRunning}
          />
        </div>

        {/* 左分隔拖拽条（双击恢复默认宽度） */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="拖拽调整左栏宽度，双击重置"
          onMouseDown={() => startResize("left")}
          onDoubleClick={() => setLeftWidth(DEFAULT_LEFT_WIDTH)}
          className="w-1 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/60 transition-colors"
        />

        {/* ── 中栏: 影视视听监看台与 5 轨磁性时间轴 ── */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <ProductionWorkspace
            hasUploadedVideo={hasUploadedVideo}
            mediaPath={mediaPath}
            mediaDuration={mediaDuration}
            onImportVideo={handleDirectImportVideo}
          />
        </div>

        {/* 右分隔拖拽条（双击恢复默认宽度） */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="拖拽调整右栏宽度，双击重置"
          onMouseDown={() => startResize("right")}
          onDoubleClick={() => setRightWidth(DEFAULT_RIGHT_WIDTH)}
          className="w-1 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/60 transition-colors"
        />

        {/* ── 右栏: Multi-Agent 控制台与创作工坊 ── */}
        <div style={{ width: rightWidth }} className="shrink-0 overflow-hidden">
          <ProductionInspector
            currentProject={currentProject}
            currentStepIndex={currentStepIndex}
            isAgentRunning={isAgentRunning}
            agentAutoMode={agentAutoMode}
            onToggleAutoMode={setAgentAutoMode}
            onStartAgent={() => void handleStartMultiAgent(agentAutoMode)}
            agentMessages={agentMessages}
            breakpoint={breakpoint}
            blackboard={blackboard}
            onApproveBreakpoint={handleApproveBreakpoint}
            onGenerateScript={handleScriptGenerate}
          />
        </div>
      </div>

      <BatchImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}
