/**
 * dramaxis v1.1.0 · 生产工作台左侧机架与切片栏 (ProductionLeftSidebar)
 *
 * 核心功能:
 * - 6-Agent 智能体状态机机架 (AgentStudioRack Overview)
 * - W1 Scene-RAG 镜头切片与情绪特征提取列表
 */

import { memo } from "react";
import { AGENT_STEPS } from "@components/production/AgentStudioRack";
import { SceneCutsList } from "@components/production/SceneCutsList";
import { useWorkshopStore } from "@dramaxis/core";

interface ProductionLeftSidebarProps {
  currentStepIndex: number;
  mediaPath?: string | null;
}

export const ProductionLeftSidebar = memo(function ProductionLeftSidebar({
  currentStepIndex,
  mediaPath,
}: ProductionLeftSidebarProps) {
  const sceneCuts = useWorkshopStore((s) => s.sceneCuts);
  const setSceneCuts = useWorkshopStore((s) => s.setSceneCuts);
  const markDirty = useWorkshopStore((s) => s.markDirty);

  return (
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
          markDirty("timelineDirty", true);
          markDirty("exportDirty", true);
        }}
        mediaPath={mediaPath}
      />
    </aside>
  );
});
