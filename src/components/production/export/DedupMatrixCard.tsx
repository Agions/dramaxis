import { memo } from "react";
import type { DedupIntensity } from "@dramaxis/ipc";

interface DedupMatrixCardProps {
  antiDupZoom: number;
  onAntiDupZoomChange: (val: number) => void;
  enableAmbientBlur: boolean;
  onEnableAmbientBlurChange: (val: boolean) => void;
  dedupIntensity: DedupIntensity;
  onApplyPreset: (preset: DedupIntensity) => void;
  showAdvancedDedup: boolean;
  onToggleAdvancedDedup: () => void;
  enableSpeed: boolean;
  onEnableSpeedChange: (val: boolean) => void;
  speedRate: number;
  onSpeedRateChange: (val: number) => void;
  enableMirror: boolean;
  onEnableMirrorChange: (val: boolean) => void;
  enableNoise: boolean;
  onEnableNoiseChange: (val: boolean) => void;
  noiseStrength: number;
  onNoiseStrengthChange: (val: number) => void;
  enableFpsDrift: boolean;
  onEnableFpsDriftChange: (val: boolean) => void;
  enablePitchShift: boolean;
  onEnablePitchShiftChange: (val: boolean) => void;
  pitchShiftRate: number;
  onPitchShiftRateChange: (val: number) => void;
  enableBgmReverb: boolean;
  onEnableBgmReverbChange: (val: boolean) => void;
  enableMetadataScrub: boolean;
  onEnableMetadataScrubChange: (val: boolean) => void;
  isFissioning: boolean;
  isRendering: boolean;
  fissionCount: number;
  onFissionCountChange: (val: number) => void;
  fissionProgress: number;
  fissionMessage: string;
  onBatchFission: () => Promise<void>;
}

export const DedupMatrixCard = memo(function DedupMatrixCard({
  antiDupZoom,
  onAntiDupZoomChange,
  enableAmbientBlur,
  onEnableAmbientBlurChange,
  dedupIntensity,
  onApplyPreset,
  showAdvancedDedup,
  onToggleAdvancedDedup,
  enableSpeed,
  onEnableSpeedChange,
  speedRate,
  onSpeedRateChange,
  enableMirror,
  onEnableMirrorChange,
  enableNoise,
  onEnableNoiseChange,
  noiseStrength,
  onNoiseStrengthChange,
  enableFpsDrift,
  onEnableFpsDriftChange,
  enablePitchShift,
  onEnablePitchShiftChange,
  pitchShiftRate,
  onPitchShiftRateChange,
  enableBgmReverb,
  onEnableBgmReverbChange,
  enableMetadataScrub,
  onEnableMetadataScrubChange,
  isFissioning,
  isRendering,
  fissionCount,
  onFissionCountChange,
  fissionProgress,
  fissionMessage,
  onBatchFission,
}: DedupMatrixCardProps) {
  const presets = [
    { id: "mild" as const, label: "自然原生", desc: "画质优先" },
    { id: "standard" as const, label: "工业标准", desc: "推荐平衡" },
    { id: "aggressive" as const, label: "多渠道定制", desc: "平台微调" },
  ];

  return (
    <>
      {/* 多平台母带定制与微调参数 */}
      <div className="rounded-xl border border-border bg-bg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary">
              多平台母带定制与微调 (Mastering)
            </span>
            <span className="rounded bg-gold/15 px-1 py-0.2 text-[8px] font-mono text-gold font-bold">
              8 项音画微调
            </span>
          </div>
          <span className="text-[9px] font-mono text-gold">AI 自动应用</span>
        </div>

        {/* 预设方案切换 */}
        <div className="grid grid-cols-3 gap-1">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              className={`rounded border p-1 text-center transition-all ${
                dedupIntensity === preset.id
                  ? "border-gold bg-gold/15 text-gold font-bold"
                  : "border-border bg-surface text-text-secondary hover:border-gold/50"
              }`}
            >
              <div className="text-[10px]">{preset.label}</div>
              <div className="text-[8px] opacity-70">{preset.desc}</div>
            </button>
          ))}
        </div>

        {/* 1. 画面动态微缩放 */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-text-secondary">
              画面动态微缩放 (1.00x ~ 1.08x)
            </span>
            <span className="font-mono text-gold">
              {antiDupZoom.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            aria-label="画面动态微缩放"
            min={1.0}
            max={1.08}
            step={0.01}
            value={antiDupZoom}
            onChange={(e) => onAntiDupZoomChange(parseFloat(e.target.value))}
            className="w-full accent-gold"
          />
        </div>

        {/* 环境底衬 */}
        <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer">
          <span>9:16 竖屏高斯模糊环境底衬</span>
          <input
            type="checkbox"
            checked={enableAmbientBlur}
            onChange={(e) => onEnableAmbientBlurChange(e.target.checked)}
            className="accent-gold"
          />
        </label>

        {/* 展开/收起 8 维高级消重算子 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onToggleAdvancedDedup}
            className="w-full flex items-center justify-between text-[10px] text-text-muted hover:text-gold transition-colors py-1"
          >
            <span>8 维音画混淆算子精细调节</span>
            <span>{showAdvancedDedup ? "收起 ▲" : "展开 ▼"}</span>
          </button>

          {showAdvancedDedup && (
            <div className="mt-2 space-y-2.5 rounded-lg border border-border/70 bg-surface/50 p-2 text-[10px]">
              {/* 2. 帧率微变速 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSpeed}
                      onChange={(e) => onEnableSpeedChange(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>帧率微变速</span>
                  </label>
                  <span className="font-mono text-gold">{speedRate.toFixed(3)}x</span>
                </div>
                {enableSpeed && (
                  <input
                    type="range"
                    min={1.005}
                    max={1.05}
                    step={0.005}
                    value={speedRate}
                    onChange={(e) => onSpeedRateChange(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 3. 智能镜像翻转 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>画面水平翻转 (Smart Mirror)</span>
                <input
                  type="checkbox"
                  checked={enableMirror}
                  onChange={(e) => onEnableMirrorChange(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 4. 胶片噪点 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableNoise}
                      onChange={(e) => onEnableNoiseChange(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>胶片颗粒高斯噪点</span>
                  </label>
                  <span className="font-mono text-gold">{Math.round(noiseStrength * 100)}%</span>
                </div>
                {enableNoise && (
                  <input
                    type="range"
                    min={0.01}
                    max={0.05}
                    step={0.005}
                    value={noiseStrength}
                    onChange={(e) => onNoiseStrengthChange(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 5. 抽插帧与帧率漂移 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>抽插帧与帧率微漂移 (防帧哈希对碰)</span>
                <input
                  type="checkbox"
                  checked={enableFpsDrift}
                  onChange={(e) => onEnableFpsDriftChange(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 6. 音频微调音高 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePitchShift}
                      onChange={(e) => onEnablePitchShiftChange(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>人声音高微偏移 (防声纹对碰)</span>
                  </label>
                  <span className="font-mono text-gold">
                    {pitchShiftRate >= 1.0 ? `+${((pitchShiftRate - 1.0) * 100).toFixed(1)}%` : `${((pitchShiftRate - 1.0) * 100).toFixed(1)}%`}
                  </span>
                </div>
                {enablePitchShift && (
                  <input
                    type="range"
                    min={0.98}
                    max={1.03}
                    step={0.005}
                    value={pitchShiftRate}
                    onChange={(e) => onPitchShiftRateChange(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 7. BGM空间微混响 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>BGM 空间微混响滤波</span>
                <input
                  type="checkbox"
                  checked={enableBgmReverb}
                  onChange={(e) => onEnableBgmReverbChange(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 8. 母带标准元数据封装 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>封装 Dramaxis 工业标准母带元数据</span>
                <input
                  type="checkbox"
                  checked={enableMetadataScrub}
                  onChange={(e) => onEnableMetadataScrubChange(e.target.checked)}
                  className="accent-gold"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 多版本母带批量渲染任务池 */}
      <div className="rounded-xl border border-gold/40 bg-surface p-3 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚡</span>
            <span className="text-xs font-bold text-text-primary">
              多版本母带批量导出 (Multi-Variant Export)
            </span>
          </div>
          <span className="text-[9px] font-mono text-gold font-bold">
            多渠道差异微调
          </span>
        </div>
        <p className="text-[10px] text-text-muted leading-relaxed">
          基于当前工程自动生成多份针对不同发布渠道微调的母带成品，分别适配微缩放构图、声调微调与胶片质感。
        </p>

        {isFissioning && (
          <div className="rounded-lg border border-gold/30 bg-bg p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-gold">{fissionMessage || "正在批量导出多版本母带..."}</span>
              <span className="font-mono font-bold text-gold">{fissionProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-150"
                style={{ width: `${fissionProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 text-[10px] text-text-secondary">
            <span>生成份数:</span>
            {[3, 5, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onFissionCountChange(num)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border transition-all ${
                  fissionCount === num
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-border bg-bg text-text-muted hover:border-gold/40"
                }`}
              >
                {num}份
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={isFissioning || isRendering}
            onClick={onBatchFission}
            className="rounded-lg bg-gradient-to-r from-amber to-gold px-3 py-1.5 text-[11px] font-black text-zinc-950 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isFissioning ? "母带批量压制中..." : `批量导出 ${fissionCount} 份母带`}
          </button>
        </div>
      </div>
    </>
  );
});
