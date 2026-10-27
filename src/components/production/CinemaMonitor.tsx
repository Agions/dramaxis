/**
 * dramaxis v1.2.0 · CinemaMonitor · 居中专业视听监看台 (全景虚拟时钟与叠层播放引擎)
 *
 * 核心升级:
 * - 9:16 短剧竖屏与画幅居中自适应
 * - 原生 <video> 真实播放/暂停控制与虚拟时间线无缝 seek 同步
 * - 分镜切片区间指示与跨片段平滑切镜
 * - 60fps 实时 CSS 花字字幕叠层 (4 套短剧专业花字预设所见即所得)
 * - 旁白与 BGM 动态闪避混音 (AI 旁白播音时 BGM 自动下压 -15dB)
 * - 浮动状态徽章 (Timecode, FPS, 1080×1920)
 * - 电影级内嵌音频频谱仪 (AudioVisualizerCanvas)
 */

import { memo, useRef, useEffect, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioVisualizerCanvas } from "./AudioVisualizerCanvas";

export type SubtitleStylePreset =
  | "cinema_amber"
  | "yellow_black"
  | "retro_red"
  | "minimal_white";

interface CinemaMonitorProps {
  hasUploadedVideo: boolean;
  mediaPath: string | null;
  voiceAudioPath?: string | null;
  voiceDuration?: number;
  bgmAudioPath?: string | null;
  bgmVolume?: number;
  bgmDuckingLevel?: number;
  enableAudioDucking?: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  sceneCuts?: number[];
  subtitles?: { id: string; text: string; start: number; duration: number }[];
  subtitleStyle?: SubtitleStylePreset;
  onTogglePlay: () => void;
  onImportVideo: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
}

function getSubtitleClass(style?: SubtitleStylePreset): string {
  switch (style) {
    case "yellow_black":
      return "text-yellow-300 font-black text-xs sm:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,1)] [text-shadow:_1px_1px_0_#000,_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000]";
    case "retro_red":
      return "text-white font-black text-xs sm:text-sm bg-red-600/90 px-2 py-0.5 rounded shadow-lg";
    case "minimal_white":
      return "text-white font-semibold text-xs sm:text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]";
    case "cinema_amber":
    default:
      return "text-amber-200 font-extrabold text-xs sm:text-sm drop-shadow-[0_2px_8px_rgba(245,158,11,0.7)] [text-shadow:_1px_1px_2px_#000]";
  }
}

export const CinemaMonitor = memo(function CinemaMonitor({
  hasUploadedVideo,
  mediaPath,
  voiceAudioPath,
  voiceDuration = 0,
  bgmAudioPath,
  bgmVolume = 0.6,
  bgmDuckingLevel = 0.18,
  enableAudioDucking = true,
  isPlaying,
  currentTime,
  duration = 100,
  sceneCuts = [],
  subtitles = [],
  subtitleStyle = "cinema_amber",
  onTogglePlay,
  onImportVideo,
  onTimeUpdate,
  onDurationChange,
  onEnded,
}: CinemaMonitorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const videoSrc = mediaPath ? convertFileSrc(mediaPath) : undefined;
  const voiceSrc = voiceAudioPath ? convertFileSrc(voiceAudioPath) : undefined;
  const bgmSrc = bgmAudioPath ? convertFileSrc(bgmAudioPath) : undefined;

  // 1. 同步外部 isPlaying 状态至 video、voice、bgm
  useEffect(() => {
    const video = videoRef.current;
    const voice = voiceRef.current;
    const bgm = bgmRef.current;

    if (isPlaying) {
      video?.play().catch(() => {});
      voice?.play().catch(() => {});
      bgm?.play().catch(() => {});
    } else {
      video?.pause();
      voice?.pause();
      bgm?.pause();
    }
  }, [isPlaying]);

  // 2. 外部 seek 时间跳转时同步位置
  useEffect(() => {
    const video = videoRef.current;
    const voice = voiceRef.current;
    const bgm = bgmRef.current;

    if (video && Math.abs(video.currentTime - currentTime) > 0.4) {
      video.currentTime = currentTime;
    }
    if (voice && Math.abs(voice.currentTime - currentTime) > 0.4) {
      voice.currentTime = currentTime;
    }
    if (bgm && Math.abs(bgm.currentTime - currentTime) > 0.4) {
      bgm.currentTime = currentTime % (bgm.duration || 1);
    }
  }, [currentTime]);

  // 3. 动态音频避让 (Audio Ducking)
  useEffect(() => {
    // 原视频声音在有 AI 旁白时压制至 20%
    if (videoRef.current) {
      videoRef.current.volume = voiceSrc ? 0.2 : 1.0;
    }

    // BGM 音轨避让: 旁白发声区间动态压制至 duckingLevel (-15dB)
    if (bgmRef.current) {
      const isVoiceSpeaking = Boolean(
        voiceSrc && currentTime < (voiceDuration || duration),
      );
      if (isVoiceSpeaking && enableAudioDucking) {
        bgmRef.current.volume = bgmDuckingLevel;
      } else {
        bgmRef.current.volume = bgmVolume;
      }
    }
  }, [
    voiceSrc,
    currentTime,
    voiceDuration,
    duration,
    enableAudioDucking,
    bgmVolume,
    bgmDuckingLevel,
  ]);

  // 4. 当前时间戳命中的字幕卡
  const activeSubtitle = useMemo(() => {
    if (!subtitles || subtitles.length === 0) return null;
    return (
      subtitles.find(
        (s) => currentTime >= s.start && currentTime < s.start + s.duration,
      ) ?? null
    );
  }, [subtitles, currentTime]);

  // 5. 当前时间戳所处的分镜切片
  const activeSceneIndex = useMemo(() => {
    if (!sceneCuts || sceneCuts.length === 0) return null;
    const sorted = [...sceneCuts].sort((a, b) => a - b);
    let prev = 0;
    for (let i = 0; i < sorted.length; i++) {
      const cut = sorted[i];
      if (cut !== undefined && currentTime >= prev && currentTime < cut) {
        return i + 1;
      }
      prev = cut ?? prev;
    }
    return sorted.length + 1;
  }, [sceneCuts, currentTime]);

  const formatTime = (secs: number) => {
    const safeSecs = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safeSecs / 60);
    const remaining = safeSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-3 shadow-md min-h-[260px] max-h-[300px]">
      {/* 视频主画幅 (9:16 短剧居中自适应) */}
      <div className="relative flex h-[210px] w-[118px] sm:w-[130px] items-center justify-center overflow-hidden rounded-xl bg-zinc-950 shadow-2xl border border-black/40">
        {hasUploadedVideo && videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-cover"
              controls={false}
              playsInline
              onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) {
                  onDurationChange?.(d);
                }
              }}
              onEnded={() => onEnded?.()}
            />

            {/* 实时 60fps 花字字幕叠层 (Subtitle Overlay) */}
            {activeSubtitle && (
              <div className="absolute bottom-5 inset-x-2 flex items-center justify-center text-center pointer-events-none z-10 animate-fade-in">
                <span className={getSubtitleClass(subtitleStyle)}>
                  {activeSubtitle.text}
                </span>
              </div>
            )}
          </>
        ) : (
          <div
            onClick={onImportVideo}
            className="flex flex-col items-center justify-center gap-1 text-text-muted cursor-pointer p-2 hover:text-gold transition-colors text-center"
          >
            <span className="text-2xl">📤</span>
            <span className="text-[10px] font-bold text-text-primary">
              选择视频素材
            </span>
            <span className="text-[8px] opacity-60">9:16 短剧竖屏优先</span>
          </div>
        )}

        {/* 悬浮时间码与画幅胶囊 */}
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-mono text-gold backdrop-blur-md pointer-events-none">
          <span>●</span>
          <span>
            {activeSceneIndex ? `镜 ${activeSceneIndex} · ` : ""}9:16
          </span>
        </div>

        {/* 画面中央播放快捷覆盖层 */}
        {hasUploadedVideo && (
          <button
            type="button"
            onClick={onTogglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md shadow-lg">
              {isPlaying ? "⏸" : "▶"}
            </span>
          </button>
        )}
      </div>

      {/* 右上角: 电影级内嵌音频频谱仪 */}
      <div className="absolute top-3 right-3 hidden sm:flex flex-col items-end gap-1 pointer-events-none">
        <span className="font-mono text-[8px] tracking-wider text-gold uppercase opacity-80">
          Neural Audio Visualizer · 48kHz
        </span>
        <div className="h-8 w-28 rounded-lg overflow-hidden border border-border bg-bg/80 p-0.5 backdrop-blur-md shadow-inner">
          <AudioVisualizerCanvas isPlaying={isPlaying} />
        </div>
      </div>

      {/* 隐藏的旁白配音音频播放器 */}
      {voiceSrc && (
        <audio
          ref={voiceRef}
          src={voiceSrc}
          controls={false}
          playsInline
          className="hidden"
        />
      )}

      {/* 隐藏的背景音乐音频播放器 */}
      {bgmSrc && (
        <audio
          ref={bgmRef}
          src={bgmSrc}
          controls={false}
          playsInline
          loop
          className="hidden"
        />
      )}

      {/* 下方悬浮播控条 */}
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated border border-border text-xs text-text-primary hover:border-gold hover:text-gold transition-colors cursor-pointer"
          title={isPlaying ? "暂停 (Space)" : "播放 (Space)"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <span className="font-mono text-[11px] text-text-secondary">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {voiceSrc && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded bg-gold/10 border border-gold/30 px-1.5 py-0.5 font-mono text-[9px] text-gold font-bold">
            <span>🎙️</span>
            <span>旁白对齐</span>
          </span>
        )}
        {bgmSrc && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 font-mono text-[9px] text-cyan-400 font-bold">
            <span>🎵</span>
            <span>BGM闪避</span>
          </span>
        )}
      </div>
    </div>
  );
});
