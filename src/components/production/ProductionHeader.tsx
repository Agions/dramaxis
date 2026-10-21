/**
 * dramaxis v1.1.0 · 生产工作台顶栏总控组件 (ProductionHeader)
 *
 * 核心功能:
 * - 工程标题展示与 SQLite 事务级撤销/重做 (Undo / Redo)
 * - 4 大工坊步进指示器 (Workshop Stepper) 与响应式脏标记 (Dirty State) 呼吸灯
 * - 一键启动 6-Agent 智能体闭环流水线
 */

import { memo } from "react";
import { useWorkshopStore, type WorkshopKind } from "@dramaxis/core";

export const WORKSHOP_STAGES: {
  id: WorkshopKind;
  step: string;
  name: string;
  icon: string;
}[] = [
  { id: "assets", step: "W1", name: "素材工坊", icon: "🎞️" },
  { id: "script", step: "W2", name: "剧本工坊", icon: "✍️" },
  { id: "timeline", step: "W3", name: "时间轴工坊", icon: "⏱️" },
  { id: "export", step: "W4", name: "交付工坊", icon: "🚀" },
];

interface ProductionHeaderProps {
  projectName?: string;
  hasUploadedVideo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onStartAgent: () => void;
  isAgentRunning: boolean;
}

export const ProductionHeader = memo(function ProductionHeader({
  projectName = "未命名短剧工程",
  hasUploadedVideo,
  onUndo,
  onRedo,
  onStartAgent,
  isAgentRunning,
}: ProductionHeaderProps) {
  const activeWorkshop = useWorkshopStore((s) => s.activeWorkshop);
  const setActiveWorkshop = useWorkshopStore((s) => s.setActiveWorkshop);
  const setActiveTab = useWorkshopStore((s) => s.setActiveTab);
  const scriptText = useWorkshopStore((s) => s.scriptText);
  const voiceAudioPath = useWorkshopStore((s) => s.voiceAudioPath);
  const sceneCuts = useWorkshopStore((s) => s.sceneCuts);
  const dirtyState = useWorkshopStore((s) => s.dirtyState);

  const handleSelectWorkshop = (w: WorkshopKind) => {
    setActiveWorkshop(w);
    if (w === "script") setActiveTab("script");
    else if (w === "timeline") setActiveTab("voice");
    else if (w === "export") setActiveTab("export");
    else setActiveTab("agent");
  };

  const isW1Ready = hasUploadedVideo;
  const isW2Ready = Boolean(scriptText && scriptText.length > 20);
  const isW3Ready = Boolean(voiceAudioPath && sceneCuts.length > 0);
  const isW4Ready = Boolean(isW1Ready && (isW3Ready || isW2Ready));

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4 z-20 shadow-sm">
      {/* 左侧: 工程名 + SQLite 事务 Undo/Redo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-xs font-black tracking-tight text-text-primary">
            {projectName}
          </span>
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-2">
          <button
            type="button"
            onClick={onUndo}
            className="rounded p-1 text-[11px] text-text-muted hover:bg-surface-elevated hover:text-gold transition-colors"
            title="撤销 (⌘Z)"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={onRedo}
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

      {/* 右侧: 启动 Multi-Agent 协作流水线 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStartAgent}
          disabled={isAgentRunning}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-amber px-3.5 py-1.5 text-xs font-black text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <span>{isAgentRunning ? "⏳" : "⚡"}</span>
          <span>
            {isAgentRunning ? "智能体协同中..." : "启动 Multi-Agent 流水线"}
          </span>
        </button>
      </div>
    </header>
  );
});
