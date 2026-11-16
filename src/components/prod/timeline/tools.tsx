/**
 * dramaxis v1.2.0 · 时间轴顶部控制栏组件 (TimelineToolbar)
 */

import type { AlignmentPlan } from "@dramaxis/ipc";

interface TimelineToolbarProps {
  currentTime: number;
  durationSeconds: number;
  formatTime: (sec: number) => string;
  selectedClipId: string | null;
  markIn: number | null;
  markOut: number | null;
  onClearMarks: () => void;
  alignmentPlan: AlignmentPlan | null;
  onAutoAlign?: () => void;
  isAligning: boolean;
  autoDucking: boolean;
  bgmMixRatio: number;
  onDuckingChange?: (enabled: boolean) => void;
  zoomLevel: number;
  onZoomChange: (updater: (prev: number) => number) => void;
}

export function TimelineToolbar({
  currentTime,
  durationSeconds,
  formatTime,
  selectedClipId,
  markIn,
  markOut,
  onClearMarks,
  alignmentPlan,
  onAutoAlign,
  isAligning,
  autoDucking,
  bgmMixRatio,
  onDuckingChange,
  zoomLevel,
  onZoomChange,
}: TimelineToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5 text-xs shrink-0">
      <div className="flex items-center gap-3 font-mono">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted font-semibold">POS</span>
          <span className="font-bold text-gold">{formatTime(currentTime)}</span>
        </div>
        <span className="text-border">/</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">DUR</span>
          <span className="text-text-secondary">{formatTime(durationSeconds)}</span>
        </div>
        {selectedClipId && (
          <span className="px-2 py-0.2 rounded bg-gold/15 border border-gold/40 text-[9px] font-bold text-gold">
            选中片段: {selectedClipId}
          </span>
        )}
        {markIn !== null && markOut !== null && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gold/15 border border-gold/40 text-[9px] font-mono font-bold text-gold">
            <span>
              选区: {formatTime(markIn)} - {formatTime(markOut)}
            </span>
            <button
              type="button"
              onClick={onClearMarks}
              className="hover:text-rose-400 font-bold ml-1 cursor-pointer"
              title="清除选区 (Esc)"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {alignmentPlan ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[10px]">
            <span className="font-bold text-emerald-400">
              🎯 声画契合: {alignmentPlan.overallSyncScore.toFixed(0)}%
            </span>
            <span className="text-text-muted">
              ({alignmentPlan.matches.length} 处对齐微调)
            </span>
          </div>
        ) : (
          onAutoAlign && (
            <button
              type="button"
              onClick={onAutoAlign}
              disabled={isAligning}
              className="px-2 py-0.5 rounded-lg border border-gold/40 bg-gold/15 text-[10px] font-bold text-gold hover:bg-gold/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAligning ? "⚡ 对齐中..." : "⚡ 语义+情绪双驱动对齐"}
            </button>
          )
        )}

        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-text-secondary hover:text-text-primary transition-colors">
          <input
            type="checkbox"
            checked={autoDucking}
            onChange={(e) => onDuckingChange?.(e.target.checked)}
            className="rounded accent-gold text-xs cursor-pointer"
          />
          <span>BGM 闪避 (-{bgmMixRatio}%)</span>
        </label>

        <div className="flex items-center gap-1 text-[11px] text-text-secondary font-mono">
          <button
            type="button"
            onClick={() => onZoomChange((z) => Math.max(0.5, z - 0.25))}
            className="h-5 w-5 rounded border border-border bg-surface-elevated hover:bg-border flex items-center justify-center font-bold text-text-primary transition-colors cursor-pointer"
          >
            -
          </button>
          <span className="w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            onClick={() => onZoomChange((z) => Math.min(2.5, z + 0.25))}
            className="h-5 w-5 rounded border border-border bg-surface-elevated hover:bg-border flex items-center justify-center font-bold text-text-primary transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
