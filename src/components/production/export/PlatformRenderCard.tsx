import { memo } from "react";

interface PlatformRenderCardProps {
  isRendering: boolean;
  activePreset: string | null;
  renderProgress: number;
  renderPhase: string;
  renderedVideoPath: string | null;
  onRenderPreset: (presetLabel: string) => Promise<void>;
  onOpenVideoFolder: () => Promise<void>;
}

export const PlatformRenderCard = memo(function PlatformRenderCard({
  isRendering,
  activePreset,
  renderProgress,
  renderPhase,
  renderedVideoPath,
  onRenderPreset,
  onOpenVideoFolder,
}: PlatformRenderCardProps) {
  const presets = [
    { id: "douyin", label: "抖音 / TikTok (9:16)" },
    { id: "bilibili", label: "B站 / YouTube (16:9)" },
    { id: "xiaohongshu", label: "小红书 (9:16)" },
    { id: "kuaishou", label: "快手 (9:16)" },
  ];

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-text-primary">
          直接渲染成片 (MP4)
        </label>
        <span className="text-[9px] font-mono text-emerald-400 font-bold">
          FFmpeg 硬件加速
        </span>
      </div>

      {/* 渲染进度条展示 */}
      {isRendering && (
        <div className="rounded-lg border border-gold/30 bg-bg p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-gold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
              <span>{renderPhase || "压制中..."}</span>
            </span>
            <span className="font-mono font-bold text-gold">
              {renderProgress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-150"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={isRendering}
            onClick={() => void onRenderPreset(p.label)}
            className={`rounded-lg border py-2 text-[11px] font-semibold transition-all ${
              activePreset === p.label
                ? "border-gold bg-gold/10 text-gold"
                : "border-border bg-bg text-text-secondary hover:border-gold hover:text-gold"
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {activePreset === p.label ? "正在压制..." : p.label}
          </button>
        ))}
      </div>

      {/* 成片压制完成后的定位操作 */}
      {renderedVideoPath && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 truncate max-w-[200px]">
            <span>✓</span>
            <span>成片已保存</span>
          </span>
          <button
            type="button"
            onClick={onOpenVideoFolder}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-primary hover:border-gold hover:text-gold transition-colors"
          >
            <span>📂</span>
            <span>在文件夹中定位成片</span>
          </button>
        </div>
      )}
    </div>
  );
});
