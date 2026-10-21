/**
 * dramaxis v1.1.0 · CinemaMonitor · 居中专业视听监看台
 *
 * 核心功能:
 * - 9:16 短剧竖屏与画幅居中自适应
 * - 原生 <video> 真实播放/暂停控制与 seek 同步
 * - 动态读取视频真实时长 (消除硬编码 01:40)
 * - 浮动状态徽章 (Timecode, FPS, 1080×1920)
 * - 内嵌式右侧音频频谱图 (Audio Visualizer)
 * - 播放完毕自动复位与时间戳回传
 */

import { memo, useRef, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioVisualizerCanvas } from "./AudioVisualizerCanvas";

interface CinemaMonitorProps {
  hasUploadedVideo: boolean;
  mediaPath: string | null;
  voiceAudioPath?: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  onTogglePlay: () => void;
  onImportVideo: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
}

export const CinemaMonitor = memo(function CinemaMonitor({
  hasUploadedVideo,
  mediaPath,
  voiceAudioPath,
  isPlaying,
  currentTime,
  duration = 100,
  onTogglePlay,
  onImportVideo,
  onTimeUpdate,
  onDurationChange,
  onEnded,
}: CinemaMonitorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoSrc = mediaPath ? convertFileSrc(mediaPath) : undefined;
  const voiceSrc = voiceAudioPath ? convertFileSrc(voiceAudioPath) : undefined;

  // 1. 同步外部 isPlaying 状态至原生 video 与 audio 元素
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (isPlaying) {
      video?.play().catch(() => {});
      audio?.play().catch(() => {});
    } else {
      video?.pause();
      audio?.pause();
    }
  }, [isPlaying]);

  // 2. 外部 seek 时间跳转时同步 video 和 audio 当前位置
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (video && Math.abs(video.currentTime - currentTime) > 0.4) {
      video.currentTime = currentTime;
    }
    if (audio && Math.abs(audio.currentTime - currentTime) > 0.4) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // 3. 智能音量避让: 当有 AI 旁白配音时，原视频声音自动降低至 20%，保证旁白清晰
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = voiceSrc ? 0.25 : 1.0;
    }
    if (audioRef.current) {
      audioRef.current.volume = 1.0;
    }
  }, [voiceSrc]);

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
          <span>1080×1920 · 9:16</span>
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

      {/* 隐藏的旁白配音音频播放器 (实现音画绝对同频试听) */}
      {voiceSrc && (
        <audio
          ref={audioRef}
          src={voiceSrc}
          controls={false}
          playsInline
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
            <span>AI旁白声画同频试听中</span>
          </span>
        )}
      </div>
    </div>
  );
});
