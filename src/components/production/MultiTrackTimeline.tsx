/**
 * dramaxis v1.2.0 · 全景多轨生产时间轴组件 (MultiTrackTimeline)
 *
 * 遵循专业 NLE (非线性编辑) 工业级调色/剪辑台标准:
 * - 5 轨全景磁性轨道 (V1 视频切片、HK 黄金高光、A1 第一人称独白配音、SUB 逐字花字字幕、BGM 动态闪避伴奏)
 * - 工业级轨道控制头 (Track Header): 每轨独立 Mute(静音/隐藏)、Solo(独奏/独显)、Lock(锁定防误触)
 * - 片段交互增强: 支持片段点击选中高亮 (selectedClipId)、微调对齐与键盘单帧/微调 (←/→/Esc)
 * - 沉浸式刻度标尺与发光指针 (Playhead Scrubber)
 * - 优雅空状态骨架
 */

import { useState, useRef, useCallback } from "react";
import type { AlignmentPlan } from "@dramaxis/ipc";

export type TrackId = "V1" | "HK" | "A1" | "SUB" | "BGM";

export interface TrackControlState {
  muted: boolean;
  solo: boolean;
  locked: boolean;
}

export interface TimelineClipItem {
  id: string;
  title: string;
  start: number;
  duration: number;
  emotion?: string;
  matchScore?: number;
  speedAdjustment?: number;
  isBroll?: boolean;
}

export interface MultiTrackTimelineProps {
  durationSeconds?: number;
  currentTime?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  videoClips?: TimelineClipItem[];
  hookClip?: {
    id?: string;
    title: string;
    start: number;
    duration: number;
    style?: string;
  } | null;
  voiceClips?: { id: string; text: string; start: number; duration: number }[];
  subtitleClips?: {
    id: string;
    text: string;
    start: number;
    duration: number;
  }[];
  bgmMixRatio?: number;
  autoDucking?: boolean;
  onDuckingChange?: (enabled: boolean) => void;
  alignmentPlan?: AlignmentPlan | null;
  onAutoAlign?: () => void;
  isAligning?: boolean;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  trackControls?: Partial<Record<TrackId, Partial<TrackControlState>>>;
  onTrackControlChange?: (
    trackId: TrackId,
    control: keyof TrackControlState,
    value: boolean,
  ) => void;
}

const DEFAULT_TRACK_CONTROLS: Record<TrackId, TrackControlState> = {
  V1: { muted: false, solo: false, locked: false },
  HK: { muted: false, solo: false, locked: false },
  A1: { muted: false, solo: false, locked: false },
  SUB: { muted: false, solo: false, locked: false },
  BGM: { muted: false, solo: false, locked: false },
};

export function MultiTrackTimeline({
  durationSeconds = 60,
  currentTime = 0,
  isPlaying: _isPlaying = false,
  onSeek,
  videoClips = [],
  hookClip = null,
  voiceClips = [],
  subtitleClips = [],
  bgmMixRatio = 18,
  autoDucking = true,
  onDuckingChange,
  alignmentPlan = null,
  onAutoAlign,
  isAligning = false,
  selectedClipId: controlledSelectedClipId,
  onSelectClip,
  trackControls: controlledTrackControls,
  onTrackControlChange,
}: MultiTrackTimelineProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [internalSelectedClipId, setInternalSelectedClipId] = useState<
    string | null
  >(null);
  const [internalTrackControls, setInternalTrackControls] = useState<
    Record<TrackId, TrackControlState>
  >(DEFAULT_TRACK_CONTROLS);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 选中态受控与非受控兼容
  const selectedClipId =
    controlledSelectedClipId !== undefined
      ? controlledSelectedClipId
      : internalSelectedClipId;

  const handleSelectClip = useCallback(
    (id: string | null) => {
      setInternalSelectedClipId(id);
      onSelectClip?.(id);
    },
    [onSelectClip],
  );

  // 轨道控制受控与非受控合并
  const trackControls: Record<TrackId, TrackControlState> = {
    V1: {
      ...DEFAULT_TRACK_CONTROLS.V1,
      ...internalTrackControls.V1,
      ...controlledTrackControls?.V1,
    },
    HK: {
      ...DEFAULT_TRACK_CONTROLS.HK,
      ...internalTrackControls.HK,
      ...controlledTrackControls?.HK,
    },
    A1: {
      ...DEFAULT_TRACK_CONTROLS.A1,
      ...internalTrackControls.A1,
      ...controlledTrackControls?.A1,
    },
    SUB: {
      ...DEFAULT_TRACK_CONTROLS.SUB,
      ...internalTrackControls.SUB,
      ...controlledTrackControls?.SUB,
    },
    BGM: {
      ...DEFAULT_TRACK_CONTROLS.BGM,
      ...internalTrackControls.BGM,
      ...controlledTrackControls?.BGM,
    },
  };

  const handleToggleTrackControl = useCallback(
    (trackId: TrackId, control: keyof TrackControlState) => {
      const nextValue = !trackControls[trackId][control];
      setInternalTrackControls((prev) => ({
        ...prev,
        [trackId]: {
          ...prev[trackId],
          [control]: nextValue,
        },
      }));
      onTrackControlChange?.(trackId, control, nextValue);
    },
    [trackControls, onTrackControlChange],
  );

  // 独奏逻辑判定: 是否存在任意轨道处于 Solo 状态
  const hasAnySolo = Object.values(trackControls).some((t) => t.solo);

  // 轨道可见度/活动态判定
  const isTrackActive = (trackId: TrackId) => {
    const ctrl = trackControls[trackId];
    if (ctrl.muted) return false;
    if (hasAnySolo) return ctrl.solo;
    return true;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const totalWidth = containerRef.current.scrollWidth || rect.width;
    const ratio = Math.max(0, Math.min(1, clickX / totalWidth));
    onSeek(ratio * durationSeconds);
  };

  // 键盘快捷微调 (ArrowLeft / ArrowRight / Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSelectClip(null);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2;
        const delta = e.key === "ArrowLeft" ? -step : step;
        const targetTime = Math.max(0, Math.min(durationSeconds, currentTime + delta));
        onSeek?.(targetTime);
      }
    },
    [currentTime, durationSeconds, handleSelectClip, onSeek],
  );

  const playheadPercent = Math.min(
    100,
    (currentTime / (durationSeconds || 1)) * 100,
  );

  const isEmpty =
    videoClips.length === 0 && voiceClips.length === 0 && !hookClip;
  const contentWidthPercent = Math.max(100, Math.round(zoomLevel * 100));

  // 轨道头渲染辅助组件
  const renderTrackHeader = (
    trackId: TrackId,
    label: string,
    colorClass: string,
  ) => {
    const ctrl = trackControls[trackId];
    return (
      <div className="flex items-center justify-between w-28 pr-1.5 shrink-0 select-none">
        <span
          className={`font-mono text-[10px] font-bold ${colorClass} truncate`}
        >
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          {/* Mute 开关 */}
          <button
            type="button"
            title={ctrl.muted ? "取消静音/显示该轨" : "静音/隐藏该轨 (M)"}
            aria-label={`${trackId}-mute`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTrackControl(trackId, "muted");
            }}
            className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
              ctrl.muted
                ? "bg-rose-500/25 border-rose-500 text-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.4)]"
                : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
            }`}
          >
            M
          </button>

          {/* Solo 开关 */}
          <button
            type="button"
            title={ctrl.solo ? "取消独显 (S)" : "独奏/独显该轨 (S)"}
            aria-label={`${trackId}-solo`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTrackControl(trackId, "solo");
            }}
            className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
              ctrl.solo
                ? "bg-amber-500/25 border-amber-500 text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
            }`}
          >
            S
          </button>

          {/* Lock 开关 */}
          <button
            type="button"
            title={ctrl.locked ? "解锁该轨 (L)" : "锁定轨道防误触 (L)"}
            aria-label={`${trackId}-lock`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTrackControl(trackId, "locked");
            }}
            className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
              ctrl.locked
                ? "bg-sky-500/25 border-sky-500 text-sky-400 shadow-[0_0_6px_rgba(14,165,233,0.4)]"
                : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
            }`}
          >
            L
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex h-full w-full flex-col select-none font-sans outline-none focus:ring-1 focus:ring-gold/30 rounded-lg"
    >
      {/* 1. 顶部控制栏: 缩放、BGM 闪避控制、时间码、声画对齐状态 */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted font-semibold">
              POS
            </span>
            <span className="font-bold text-gold">
              {formatTime(currentTime)}
            </span>
          </div>
          <span className="text-border">/</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted">DUR</span>
            <span className="text-text-secondary">
              {formatTime(durationSeconds)}
            </span>
          </div>
          {selectedClipId && (
            <span className="px-2 py-0.2 rounded bg-gold/15 border border-gold/40 text-[9px] font-bold text-gold">
              选中片段: {selectedClipId}
            </span>
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
                className="px-2 py-0.5 rounded-lg border border-gold/40 bg-gold/15 text-[10px] font-bold text-gold hover:bg-gold/25 transition-all disabled:opacity-50"
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
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="h-5 w-5 rounded border border-border bg-surface-elevated hover:bg-border flex items-center justify-center font-bold text-text-primary transition-colors"
            >
              -
            </button>
            <span className="w-8 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="h-5 w-5 rounded border border-border bg-surface-elevated hover:bg-border flex items-center justify-center font-bold text-text-primary transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. 主轨道网格区 */}
      <div className="relative flex-1 flex flex-col overflow-hidden bg-bg p-2 gap-1.5">
        {/* 时间标尺刻度 */}
        <div className="h-4 w-full flex justify-between pl-30 pr-2 font-mono text-[9px] text-text-muted border-b border-border/60">
          <span>00:00.0</span>
          <span>00:15.0</span>
          <span>00:30.0</span>
          <span>00:45.0</span>
          <span>{formatTime(durationSeconds)}</span>
        </div>

        {/* 轨道层容器 */}
        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative flex-1 flex flex-col cursor-crosshair overflow-x-auto overflow-y-auto"
        >
          <div
            className="relative flex-1 flex flex-col gap-1.5 min-h-full"
            style={{ minWidth: `${contentWidthPercent}%` }}
          >
            {/* Playhead 播放指针 (从标尺偏移位置向右对齐) */}
            <div
              className="absolute top-0 bottom-0 z-30 w-[2px] bg-gradient-to-b from-gold via-amber-400 to-amber-600 shadow-[0_0_8px_var(--color-gold)] pointer-events-none transition-all duration-75"
              style={{
                left: `calc(112px + (100% - 112px) * ${playheadPercent / 100})`,
              }}
            >
              <div className="h-2 w-2 -translate-x-[3px] rotate-45 bg-gold shadow-[0_0_6px_var(--color-gold)]" />
            </div>

            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-text-muted text-xs gap-1.5 my-auto">
                <span className="text-2xl">⏱️</span>
                <span className="font-bold text-text-secondary">
                  多轨时间轴待命
                </span>
                <span className="text-[10px]">
                  导入素材或启动 Multi-Agent 智能体将实时排布 5 轨视听流
                </span>
              </div>
            ) : (
              <>
                {/* Track 1: 视频分镜切片 (V1) */}
                <div
                  className={`flex items-center gap-2 h-8 rounded-lg bg-surface border border-border px-2 transition-opacity ${
                    !isTrackActive("V1") ? "opacity-35 grayscale" : "opacity-100"
                  }`}
                >
                  {renderTrackHeader("V1", "V1 视频", "text-sky-400")}
                  <div
                    className={`relative flex-1 h-5 flex gap-1 ${
                      trackControls.V1.locked ? "pointer-events-none" : ""
                    }`}
                  >
                    {videoClips.map((c) => {
                      const isSelected = selectedClipId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            if (trackControls.V1.locked) return;
                            e.stopPropagation();
                            handleSelectClip(c.id);
                            onSeek?.(c.start);
                          }}
                          className={`h-full rounded bg-sky-950/70 dark:bg-sky-950/70 light:bg-sky-100 border px-2 flex items-center justify-between text-[10px] text-sky-300 font-medium truncate cursor-pointer transition-all ${
                            isSelected
                              ? "border-gold ring-2 ring-gold/70 shadow-[0_0_10px_rgba(234,179,8,0.4)] z-10"
                              : "border-sky-500/40 hover:border-sky-400"
                          }`}
                          style={{
                            width: `${(c.duration / (durationSeconds || 1)) * 100}%`,
                          }}
                        >
                          <span className="truncate">{c.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {c.matchScore !== undefined && (
                              <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-1 py-0.2 text-[8px] text-emerald-300 font-mono font-bold">
                                {c.matchScore.toFixed(0)}%
                              </span>
                            )}
                            {c.speedAdjustment &&
                            Math.abs(c.speedAdjustment - 1.0) > 0.02 ? (
                              <span className="rounded bg-amber-950/80 border border-amber-500/50 px-1 py-0.2 text-[8px] text-amber-300 font-mono">
                                {c.speedAdjustment.toFixed(2)}x
                              </span>
                            ) : null}
                            {c.isBroll && (
                              <span className="rounded bg-purple-950/80 border border-purple-500/50 px-1 py-0.2 text-[8px] text-purple-300 font-bold">
                                B-roll
                              </span>
                            )}
                            {c.emotion && (
                              <span className="rounded bg-sky-900/60 px-1 py-0.2 text-[8px] text-sky-200 shrink-0">
                                {c.emotion}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Track 2: 0~3s 黄金 Hook 轨 (HK) */}
                {hookClip && (
                  <div
                    className={`flex items-center gap-2 h-8 rounded-lg bg-surface border border-amber-500/40 px-2 transition-opacity ${
                      !isTrackActive("HK") ? "opacity-35 grayscale" : "opacity-100"
                    }`}
                  >
                    {renderTrackHeader("HK", "HK 高光", "text-gold")}
                    <div
                      className={`relative flex-1 h-5 ${
                        trackControls.HK.locked ? "pointer-events-none" : ""
                      }`}
                    >
                      <div
                        onClick={(e) => {
                          if (trackControls.HK.locked) return;
                          e.stopPropagation();
                          handleSelectClip(hookClip.id || "hook-clip");
                          onSeek?.(hookClip.start);
                        }}
                        className={`h-full rounded bg-gradient-to-r from-amber-500/30 to-yellow-500/15 border px-2 flex items-center gap-1 text-[9px] font-bold text-gold animate-pulse cursor-pointer transition-all ${
                          selectedClipId === (hookClip.id || "hook-clip")
                            ? "border-gold ring-2 ring-gold shadow-[0_0_10px_rgba(234,179,8,0.5)] z-10"
                            : "border-amber-400/60 hover:border-gold"
                        }`}
                        style={{
                          width: `${(hookClip.duration / (durationSeconds || 1)) * 100}%`,
                        }}
                      >
                        <span>🔥</span>
                        <span className="truncate">{hookClip.title}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Track 3: 第一人称独白配音轨 (A1) */}
                <div
                  className={`flex items-center gap-2 h-8 rounded-lg bg-surface border border-border px-2 transition-opacity ${
                    !isTrackActive("A1") ? "opacity-35 grayscale" : "opacity-100"
                  }`}
                >
                  {renderTrackHeader("A1", "A1 配音", "text-emerald-400")}
                  <div
                    className={`relative flex-1 h-5 flex gap-1 ${
                      trackControls.A1.locked ? "pointer-events-none" : ""
                    }`}
                  >
                    {voiceClips.map((c) => {
                      const isSelected = selectedClipId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            if (trackControls.A1.locked) return;
                            e.stopPropagation();
                            handleSelectClip(c.id);
                            onSeek?.(c.start);
                          }}
                          className={`h-full rounded bg-emerald-950/70 border px-2 flex items-center text-[10px] text-emerald-300 truncate cursor-pointer transition-all ${
                            isSelected
                              ? "border-gold ring-2 ring-gold/70 shadow-[0_0_10px_rgba(234,179,8,0.4)] z-10"
                              : "border-emerald-500/40 hover:border-emerald-400"
                          }`}
                          style={{
                            width: `${(c.duration / (durationSeconds || 1)) * 100}%`,
                          }}
                        >
                          <span className="truncate">🎙️ {c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Track 4: 逐字高亮字幕轨 (SUB) */}
                <div
                  className={`flex items-center gap-2 h-7 rounded-lg bg-surface border border-border px-2 transition-opacity ${
                    !isTrackActive("SUB") ? "opacity-35 grayscale" : "opacity-100"
                  }`}
                >
                  {renderTrackHeader("SUB", "SUB 字幕", "text-purple-400")}
                  <div
                    className={`relative flex-1 h-4 flex gap-1 ${
                      trackControls.SUB.locked ? "pointer-events-none" : ""
                    }`}
                  >
                    {subtitleClips.map((c) => {
                      const isSelected = selectedClipId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            if (trackControls.SUB.locked) return;
                            e.stopPropagation();
                            handleSelectClip(c.id);
                            onSeek?.(c.start);
                          }}
                          className={`h-full rounded bg-purple-950/60 border px-1.5 flex items-center text-[9px] text-purple-300 truncate cursor-pointer transition-all ${
                            isSelected
                              ? "border-gold ring-2 ring-gold/70 z-10"
                              : "border-purple-500/30 hover:border-purple-400"
                          }`}
                          style={{
                            width: `${(c.duration / (durationSeconds || 1)) * 100}%`,
                          }}
                        >
                          <span className="truncate">{c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Track 5: BGM 闪避动态轨 (BGM) */}
                <div
                  className={`flex items-center gap-2 h-7 rounded-lg bg-surface border border-border px-2 transition-opacity ${
                    !isTrackActive("BGM") ? "opacity-35 grayscale" : "opacity-100"
                  }`}
                >
                  {renderTrackHeader("BGM", "BGM 伴奏", "text-pink-400")}
                  <div
                    className={`relative flex-1 h-4 rounded bg-pink-950/40 border border-pink-500/30 px-2 flex items-center justify-between text-[9px] text-pink-300 ${
                      trackControls.BGM.locked ? "pointer-events-none" : ""
                    }`}
                  >
                    <span>🎵 悬疑激昂电影原声 (Movie Suspense Arc)</span>
                    <span className="font-mono text-[8px] text-pink-400">
                      {autoDucking ? "Ducking Active" : "Normal"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
