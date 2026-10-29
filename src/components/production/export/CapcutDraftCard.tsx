import { memo } from "react";
import type { CapcutDraftResult } from "@dramaxis/ipc";

interface CapcutDraftCardProps {
  isExportingDraft: boolean;
  exportedDraft: CapcutDraftResult | null;
  onExportJianying: () => Promise<void>;
  onOpenDraftFolder: () => Promise<void>;
  onLaunchJianying: () => Promise<void>;
  ambientLabel: string;
  ambientPath: string | null;
  ambientVolume: number;
  onSelectAmbientAudio: () => Promise<void>;
  onAmbientVolumeChange: (vol: number) => void;
  bgmLabel: string;
  bgmPath: string | null;
  bgmVolume: number;
  onSelectBgmAudio: () => Promise<void>;
  onBgmVolumeChange: (vol: number) => void;
  subtitleStyle: "cinema_amber" | "yellow_black" | "retro_red" | "minimal_white";
  onSubtitleStyleChange: (
    style: "cinema_amber" | "yellow_black" | "retro_red" | "minimal_white",
  ) => void;
  enableAudioDucking: boolean;
  onEnableAudioDuckingChange: (val: boolean) => void;
  bgmDuckingLevel: number;
  onBgmDuckingLevelChange: (val: number) => void;
}

export const CapcutDraftCard = memo(function CapcutDraftCard({
  isExportingDraft,
  exportedDraft,
  onExportJianying,
  onOpenDraftFolder,
  onLaunchJianying,
  ambientLabel,
  ambientPath,
  ambientVolume,
  onSelectAmbientAudio,
  onAmbientVolumeChange,
  bgmLabel,
  bgmPath,
  bgmVolume,
  onSelectBgmAudio,
  onBgmVolumeChange,
  subtitleStyle,
  onSubtitleStyleChange,
  enableAudioDucking,
  onEnableAudioDuckingChange,
  bgmDuckingLevel,
  onBgmDuckingLevelChange,
}: CapcutDraftCardProps) {
  return (
    <div className="rounded-2xl border border-gold bg-gold-muted p-4 space-y-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <div>
            <div className="text-xs font-black text-gold">
              剪映 PC 原生工程草稿 (.draft)
            </div>
            <div className="text-[9px] text-text-secondary">
              首选推荐 · 100% 保留多轨、字幕与音效
            </div>
          </div>
        </div>
        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-black text-gold border border-gold/40">
          原生互通
        </span>
      </div>

      <p className="text-[10px] text-text-secondary leading-relaxed">
        直接将已对齐的 5 轨工程生成为剪映原生草稿，包含时间轴切片、48kHz 配音、动态字幕样式与防重微缩放。
      </p>

      {/* 音频外挂轨挂载配置 (A2 环境音 / A3 BGM) */}
      <div className="rounded-xl border border-border/80 bg-bg/80 p-2.5 space-y-2">
        <div className="text-[10px] font-bold text-text-muted flex items-center justify-between">
          <span>🎧 音频多轨增强配置</span>
          <span className="text-[8px] font-mono text-gold opacity-80">
            自动混流与侧链避让
          </span>
        </div>

        {/* A2 环境音效轨 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary font-medium flex items-center gap-1">
            <span>🌊</span>
            <span>A2 环境音效轨:</span>
            <span className="font-mono text-cyan-400 font-bold truncate max-w-[130px]">
              {ambientLabel}
            </span>
          </span>
          <button
            type="button"
            onClick={onSelectAmbientAudio}
            className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold text-[10px] border border-cyan-500/20 transition-colors"
          >
            {ambientPath ? "更换音效" : "+ 载入音效"}
          </button>
        </div>
        {ambientPath && (
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span>音量:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ambientVolume}
              onChange={(e) => onAmbientVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <span className="font-mono text-cyan-400 w-8 text-right">
              {Math.round(ambientVolume * 100)}%
            </span>
          </div>
        )}

        {/* A3 背景配乐轨 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary font-medium flex items-center gap-1">
            <span>🎵</span>
            <span>A3 背景配乐轨:</span>
            <span className="font-mono text-purple-400 font-bold truncate max-w-[130px]">
              {bgmLabel}
            </span>
          </span>
          <button
            type="button"
            onClick={onSelectBgmAudio}
            className="px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold text-[10px] border border-purple-500/20 transition-colors"
          >
            {bgmPath ? "更换配乐" : "+ 载入配乐"}
          </button>
        </div>
        {bgmPath && (
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span>音量:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgmVolume}
              onChange={(e) => onBgmVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-purple-400"
            />
            <span className="font-mono text-purple-400 w-8 text-right">
              {Math.round(bgmVolume * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* 花字风格预设 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary">爆款字幕花字风格</span>
          <span className="text-[9px] font-mono text-gold font-bold">
            {subtitleStyle === "cinema_amber"
              ? "琥珀金 (影院调光)"
              : subtitleStyle === "yellow_black"
              ? "爆款黄黑边"
              : subtitleStyle === "retro_red"
              ? "悬疑醒目红"
              : "极简纯白"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: "cinema_amber", label: "琥珀金" },
            { id: "yellow_black", label: "黄黑边" },
            { id: "retro_red", label: "悬疑红" },
            { id: "minimal_white", label: "极简白" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                onSubtitleStyleChange(
                  s.id as
                    | "cinema_amber"
                    | "yellow_black"
                    | "retro_red"
                    | "minimal_white",
                )
              }
              className={`rounded py-1 text-[10px] font-bold transition-all border ${
                subtitleStyle === s.id
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border bg-bg text-text-secondary hover:border-gold/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 智能闪避开关与衰减深度 */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer">
          <span>BGM 智能响度自动闪避 (独白发声时动态衰减)</span>
          <input
            type="checkbox"
            checked={enableAudioDucking}
            onChange={(e) => onEnableAudioDuckingChange(e.target.checked)}
            className="accent-gold"
          />
        </label>
        {enableAudioDucking && (
          <div className="flex items-center justify-between text-[10px] text-text-muted gap-2 pl-1">
            <span>衰减深度:</span>
            <input
              type="range"
              min={0.08}
              max={0.35}
              step={0.01}
              value={bgmDuckingLevel}
              onChange={(e) => onBgmDuckingLevelChange(parseFloat(e.target.value))}
              className="w-full accent-gold"
            />
            <span className="font-mono text-gold w-14 text-right">
              {Math.round(20 * Math.log10(bgmDuckingLevel))} dB
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isExportingDraft}
        onClick={onExportJianying}
        className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-black text-zinc-950 shadow-[0_0_20px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span>🚀</span>
        <span>
          {isExportingDraft ? "正在导出多轨草稿..." : "一键导出至剪映草稿库"}
        </span>
      </button>

      {/* 导出成功后的系统联动操作 */}
      {exportedDraft && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/80">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span>✓</span>
              <span>草稿就绪: {exportedDraft.draftId}</span>
            </span>
            <span className="font-mono opacity-80">
              {exportedDraft.totalDurationSeconds.toFixed(1)}s
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onOpenDraftFolder}
              className="flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold text-text-primary hover:border-gold hover:text-gold transition-colors"
              title="在文件资源管理器中打开草稿工程文件夹"
            >
              <span>📂</span>
              <span>打开草稿目录</span>
            </button>
            <button
              type="button"
              onClick={onLaunchJianying}
              className="flex items-center justify-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-bold text-gold hover:bg-gold/20 transition-colors"
              title="尝试唤起本机安装的剪映 PC 端"
            >
              <span>🚀</span>
              <span>启动剪映</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
