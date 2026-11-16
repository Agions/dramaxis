/**
 * dramaxis v1.2.0 · 全景多轨生产时间轴组件 (MultiTrackTimeline Facade)
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { AlignmentPlan } from "@dramaxis/ipc";
import { TrackHeader, type TrackId, type TrackControlState } from "./header";
import { TimelineRuler } from "./ruler";
import { PlayheadCursor, MarkRangeMask } from "./cursor";
import { TimelineToolbar } from "./tools";
import { AudioWaveformVisual, type TimelineClipItem } from "./clip";

export type { TrackId, TrackControlState, TimelineClipItem };
export { AudioWaveformVisual };

export interface MultiTrackTimelineProps {
  durationSeconds?: number;
  currentTime?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  onTogglePlay?: () => void;
  markIn?: number | null;
  markOut?: number | null;
  onMarkChange?: (markIn: number | null, markOut: number | null) => void;
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
  onTogglePlay,
  markIn: controlledMarkIn,
  markOut: controlledMarkOut,
  onMarkChange,
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
  const [internalMarkIn, setInternalMarkIn] = useState<number | null>(null);
  const [internalMarkOut, setInternalMarkOut] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedClipId =
    controlledSelectedClipId !== undefined
      ? controlledSelectedClipId
      : internalSelectedClipId;

  const markIn = controlledMarkIn !== undefined ? controlledMarkIn : internalMarkIn;
  const markOut = controlledMarkOut !== undefined ? controlledMarkOut : internalMarkOut;

  const handleSetMarkIn = useCallback(
    (time: number) => {
      setInternalMarkIn(time);
      onMarkChange?.(time, markOut);
    },
    [markOut, onMarkChange],
  );

  const handleSetMarkOut = useCallback(
    (time: number) => {
      setInternalMarkOut(time);
      onMarkChange?.(markIn, time);
    },
    [markIn, onMarkChange],
  );

  const handleClearMarks = useCallback(() => {
    setInternalMarkIn(null);
    setInternalMarkOut(null);
    onMarkChange?.(null, null);
  }, [onMarkChange]);

  const handleSelectClip = useCallback(
    (id: string | null) => {
      setInternalSelectedClipId(id);
      onSelectClip?.(id);
    },
    [onSelectClip],
  );

  const processKeyAction = useCallback(
    (e: { key: string; code?: string; shiftKey: boolean; preventDefault: () => void }) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.code === "ArrowLeft" || e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2;
        onSeek?.(Math.max(0, Number((currentTime - step).toFixed(2))));
      } else if (e.code === "ArrowRight" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2;
        onSeek?.(Math.min(durationSeconds, Number((currentTime + step).toFixed(2))));
      } else if (e.code === "Home" || e.key === "Home") {
        e.preventDefault();
        onSeek?.(0);
      } else if (e.code === "End" || e.key === "End") {
        e.preventDefault();
        onSeek?.(durationSeconds);
      } else if (e.code === "KeyI" || e.key === "i" || e.key === "I") {
        e.preventDefault();
        handleSetMarkIn(currentTime);
      } else if (e.code === "KeyO" || e.key === "o" || e.key === "O") {
        e.preventDefault();
        handleSetMarkOut(currentTime);
      } else if (e.code === "Escape" || e.key === "Escape") {
        handleSelectClip(null);
        handleClearMarks();
      }
    },
    [
      currentTime,
      durationSeconds,
      onSeek,
      onTogglePlay,
      handleSelectClip,
      handleSetMarkIn,
      handleSetMarkOut,
      handleClearMarks,
    ],
  );

  useEffect(() => {
    const onDomKeyDown = (e: KeyboardEvent) => {
      processKeyAction(e);
    };

    window.addEventListener("keydown", onDomKeyDown);
    return () => window.removeEventListener("keydown", onDomKeyDown);
  }, [processKeyAction]);

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

  const hasAnySolo = Object.values(trackControls).some((t) => t.solo);

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

  const playheadPercent = Math.min(
    100,
    (currentTime / (durationSeconds || 1)) * 100,
  );

  const isEmpty =
    videoClips.length === 0 && voiceClips.length === 0 && !hookClip;
  const contentWidthPercent = Math.max(100, Math.round(zoomLevel * 100));

  return (
    <div className="flex h-full w-full flex-col select-none font-sans outline-none focus:ring-1 focus:ring-gold/30 rounded-lg">
      <TimelineToolbar
        currentTime={currentTime}
        durationSeconds={durationSeconds}
        formatTime={formatTime}
        selectedClipId={selectedClipId}
        markIn={markIn}
        markOut={markOut}
        onClearMarks={handleClearMarks}
        alignmentPlan={alignmentPlan}
        onAutoAlign={onAutoAlign}
        isAligning={isAligning}
        autoDucking={autoDucking}
        bgmMixRatio={bgmMixRatio}
        onDuckingChange={onDuckingChange}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
      />

      <div className="relative flex-1 flex flex-col overflow-hidden bg-bg p-2 gap-1.5">
        <TimelineRuler durationSeconds={durationSeconds} formatTime={formatTime} />

        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative flex-1 flex flex-col cursor-crosshair overflow-x-auto overflow-y-auto"
        >
          <div
            className="relative flex-1 flex flex-col gap-1.5 min-h-full"
            style={{ minWidth: `${contentWidthPercent}%` }}
          >
            <PlayheadCursor playheadPercent={playheadPercent} />

            {markIn !== null && markOut !== null && (
              <MarkRangeMask
                markIn={markIn}
                markOut={markOut}
                durationSeconds={durationSeconds}
                formatTime={formatTime}
              />
            )}

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
                  <TrackHeader
                    trackId="V1"
                    label="V1 视频"
                    colorClass="text-sky-400"
                    control={trackControls.V1}
                    onToggleControl={handleToggleTrackControl}
                  />
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
                    <TrackHeader
                      trackId="HK"
                      label="HK 高光"
                      colorClass="text-gold"
                      control={trackControls.HK}
                      onToggleControl={handleToggleTrackControl}
                    />
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
                  <TrackHeader
                    trackId="A1"
                    label="A1 配音"
                    colorClass="text-emerald-400"
                    control={trackControls.A1}
                    onToggleControl={handleToggleTrackControl}
                  />
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
                          className={`relative h-full rounded bg-emerald-950/70 border px-2 flex items-center text-[10px] text-emerald-300 truncate cursor-pointer transition-all overflow-hidden ${
                            isSelected
                              ? "border-gold ring-2 ring-gold/70 shadow-[0_0_10px_rgba(234,179,8,0.4)] z-10"
                              : "border-emerald-500/40 hover:border-emerald-400"
                          }`}
                          style={{
                            width: `${(c.duration / (durationSeconds || 1)) * 100}%`,
                          }}
                        >
                          <div className="absolute inset-0 flex items-center px-1">
                            <AudioWaveformVisual
                              seed={c.id + c.text}
                              colorClass="bg-emerald-400/40"
                              barsCount={Math.max(16, Math.min(80, Math.round(c.duration * 5)))}
                            />
                          </div>
                          <span className="relative z-10 truncate font-mono drop-shadow-xs">🎙️ {c.text}</span>
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
                  <TrackHeader
                    trackId="SUB"
                    label="SUB 字幕"
                    colorClass="text-purple-400"
                    control={trackControls.SUB}
                    onToggleControl={handleToggleTrackControl}
                  />
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
                  <TrackHeader
                    trackId="BGM"
                    label="BGM 伴奏"
                    colorClass="text-pink-400"
                    control={trackControls.BGM}
                    onToggleControl={handleToggleTrackControl}
                  />
                  <div
                    className={`relative flex-1 h-4 rounded bg-pink-950/40 border border-pink-500/30 px-2 flex items-center justify-between text-[9px] text-pink-300 overflow-hidden ${
                      trackControls.BGM.locked ? "pointer-events-none" : ""
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center px-1">
                      <AudioWaveformVisual
                        seed="bgm-suspense-movie"
                        colorClass="bg-pink-400/25"
                        barsCount={72}
                      />
                    </div>
                    <span className="relative z-10 truncate font-mono">🎵 悬疑激昂电影原声 (Movie Suspense Arc)</span>
                    <span className="relative z-10 font-mono text-[8px] text-pink-400 shrink-0 ml-1">
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
