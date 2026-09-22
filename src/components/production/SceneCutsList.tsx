/**
 * splicr v1.0.1 · SceneCutsList · 镜头分镜与关键帧切片列表
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { detectIpc } from "@splicr/ipc";

export interface SceneCut {
  id: number;
  time: string;
  tag: string;
  emotion: string;
}

interface SceneCutsListProps {
  sceneCuts: SceneCut[];
  onSetSceneCuts: (cuts: SceneCut[]) => void;
  mediaPath?: string | null;
}

function formatSecondsToTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const SceneCutsList = memo(function SceneCutsList({
  sceneCuts,
  onSetSceneCuts,
  mediaPath,
}: SceneCutsListProps) {
  const [isDetecting, setIsDetecting] = useState(false);

  const handleExtractCuts = async () => {
    if (!mediaPath) {
      toast.warning("请先在监看台载入视频素材");
      return;
    }

    setIsDetecting(true);
    const toastId = toast.loading(
      "VisualCriticAgent: 正在通过 FFmpeg 探测分镜切点与关键帧...",
    );

    try {
      const res = await detectIpc.scenes(mediaPath, 0.3);
      const cuts: SceneCut[] = [];
      let lastTime = 0;
      const duration = res.probe?.durationSeconds ?? 60;

      for (let i = 0; i < res.cuts.length; i++) {
        const t = res.cuts[i]!;
        cuts.push({
          id: i + 1,
          time: `${formatSecondsToTimestamp(lastTime)} - ${formatSecondsToTimestamp(t)}`,
          tag:
            i === 0
              ? "开篇悬念镜头"
              : i % 2 === 1
                ? "角色冲突爆发"
                : "反转高潮段落",
          emotion: i === 0 ? "高能" : i % 2 === 1 ? "紧张" : "震撼",
        });
        lastTime = t;
      }

      if (lastTime < duration) {
        cuts.push({
          id: cuts.length + 1,
          time: `${formatSecondsToTimestamp(lastTime)} - ${formatSecondsToTimestamp(duration)}`,
          tag: "收尾留白钩子",
          emotion: "悬疑",
        });
      }

      onSetSceneCuts(cuts);
      toast.success(
        `VisualCriticAgent 已提取 ${cuts.length} 组镜头切片 (总时长 ${duration.toFixed(1)}s)`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(`分镜探测失败: ${String(e)}`, { id: toastId });
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          分镜镜头切片 ({sceneCuts.length})
        </span>
        <button
          type="button"
          disabled={isDetecting}
          onClick={handleExtractCuts}
          className="text-[10px] text-gold hover:underline disabled:opacity-50"
        >
          {isDetecting ? "⏳ 探测中..." : "🔄 重新分析"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
        {sceneCuts.length > 0 ? (
          sceneCuts.map((cut) => (
            <div
              key={cut.id}
              className="group flex flex-col gap-1 rounded-lg border border-border bg-bg p-2 transition-all hover:border-gold/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-gold">
                  #{cut.id}
                </span>
                <span className="rounded bg-surface-elevated border border-border px-1.5 py-0.2 text-[8px] font-semibold text-text-secondary">
                  {cut.emotion}
                </span>
              </div>
              <div className="text-[11px] font-medium text-text-primary">
                {cut.tag}
              </div>
              <div className="font-mono text-[9px] text-text-muted">
                {cut.time}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-text-muted border border-dashed border-border rounded-xl my-auto">
            <span className="text-xl mb-1">🎬</span>
            <span>暂无镜头切片数据</span>
            <span className="text-[10px] opacity-70 mt-0.5">
              载入视频后点击右上角开始分析
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
