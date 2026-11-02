/**
 * dramaxis v1.2.0 · 剧枢 — 4 大工坊分阶流转与响应式创作中心 (声明式总装路由)
 *
 * 工业级影视智能体创作全流程体系:
 * - W1: 素材与对白摄取工坊 (Asset Hub: 视频摄取 / 场景拆条 / 格式探测)
 * - W2: 编导剧本策划工坊 (Script Studio: 编导大纲 / 爆款剧本 / 6-Agent 闭环评审)
 * - W3: 毫秒级多轨精修工坊 (Timeline Studio: 5轨毫秒磁吸 / 声画对齐 / 智能避让)
 * - W4: 8维矩阵消重与交付工坊 (Export Hub: 剪映草稿秒出 / 8维指纹防重 / 批量并发裂变)
 * - 纯声明式架构: 会话数据与快捷键下沉至 useProductionSession
 */

import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BatchImportDialog } from "@components/dialogs/BatchImportDialog";
import { ProductionHeader } from "@components/production/ProductionHeader";
import { ProductionLeftSidebar } from "@components/production/ProductionLeftSidebar";
import { ProductionWorkspace } from "@components/production/ProductionWorkspace";
import { ProductionInspector } from "@components/production/ProductionInspector";
import { useProductionSession } from "@hooks/useProductionSession";

export const Route = createFileRoute("/production")({
  component: ProductionCinemaStudio,
});

function ProductionCinemaStudio() {
  const {
    currentProject,
    hasUploadedVideo,
    mediaPath,
    showImport,
    setShowImport,
    isAgentRunning,
    agentAutoMode,
    setAgentAutoMode,
    currentStepIndex,
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
          blackboard={blackboard}
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
