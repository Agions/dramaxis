/**
 * dramaxis v1.3.0 · CinemaMonitor · 居中专业视听监看台 (全景虚拟时钟与叠层播放引擎)
 *
 * 核心升级:
 * - 9:16 短剧竖屏 / 16:9 影视长剧 / 1:1 社交方形 一键构图切换 (Aspect Ratio Switcher)
 * - 抖音 / TikTok 微短剧防遮挡交互安全区网格 (Title & Interaction Safe Zone Grid)
 * - 原生 <video> 真实播放/暂停控制与虚拟时间线无缝 seek 同步
 * - 倍速播放支持 (0.75x / 1.0x / 1.25x / 1.5x / 2.0x) 与音画锁步
 * - 分镜切片区间指示与跨片段平滑切镜
 * - 60fps 实时 CSS 花字字幕叠层 (4 套短剧专业花字预设所见即所得)
 * - 旁白与 BGM 动态闪避混音 (AI 旁白播音时 BGM 自动下压 -15dB)
 * - 悬浮时间码、帧分辨率与场景切片胶囊
 * - 电影级内嵌音频频谱仪 (AudioVisualizerCanvas)
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { memo, useRef, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioVisualizerCanvas } from "./visual";

export type SubtitleStylePreset =
  | "cinema_amber"
  | "yellow_black"
  | "retro_red"
  | "minimal_white";

export type AspectRatioKind = "9:16" | "16:9" | "1:1";

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

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

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

  // 构图比例与短剧安全区状态
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKind>("9:16");
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

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

  // 3. 动态倍速调节
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
    if (voiceRef.current) {
      voiceRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 4. 动态音频避让 (Audio Ducking)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = voiceSrc ? 0.2 : 1.0;
    }

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

  // 5. 当前时间戳命中的字幕卡
  const activeSubtitle = useMemo(() => {
    if (!subtitles || subtitles.length === 0) return null;
    return (
      subtitles.find(
        (s) => currentTime >= s.start && currentTime < s.start + s.duration,
      ) ?? null
    );
  }, [subtitles, currentTime]);

  // 6. 当前时间戳所处的分镜切片
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

  const getContainerRatioStyle = () => {
    switch (aspectRatio) {
      case "16:9":
        return "h-[210px] w-[373px] max-w-full";
      case "1:1":
        return "h-[210px] w-[210px]";
      case "9:16":
      default:
        return "h-[210px] w-[118px] sm:w-[130px]";
    }
  };

  const resolutionText =
    aspectRatio === "9:16"
      ? "1080×1920"
      : aspectRatio === "16:9"
        ? "1920×1080"
        : "1080×1080";

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-3 shadow-md min-h-[270px] max-h-[310px]">
      {/* 顶部工具栏: 构图比例切换器 + 短剧安全区开关 */}
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5 z-20">
        <div className="flex items-center rounded-lg bg-surface-elevated/90 border border-border/80 p-0.5 text-[9px] font-mono backdrop-blur-md">
          <button
            type="button"
            onClick={() => setAspectRatio("9:16")}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              aspectRatio === "9:16"
                ? "bg-gold text-zinc-950 font-bold shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="微短剧竖屏 (9:16 抖音/TikTok/快手)"
          >
            9:16 短剧
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio("16:9")}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              aspectRatio === "16:9"
                ? "bg-gold text-zinc-950 font-bold shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="影视长剧横屏 (16:9 B站/YouTube)"
          >
            16:9 影视
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio("1:1")}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              aspectRatio === "1:1"
                ? "bg-gold text-zinc-950 font-bold shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="社交正方形 (1:1)"
          >
            1:1 方形
          </button>
        </div>

        {/* 短剧安全区按钮 (9:16 专属高阶辅助) */}
        {aspectRatio === "9:16" && (
          <button
            type="button"
            onClick={() => setShowSafeZone((prev) => !prev)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[9px] font-medium backdrop-blur-md transition-all cursor-pointer ${
              showSafeZone
                ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                : "bg-surface-elevated/70 border-border/80 text-text-muted hover:text-text-primary"
            }`}
            title="切换抖音/TikTok平台防遮挡安全区辅助线"
          >
            <span>🛡️</span>
            <span>安全区</span>
          </button>
        )}
      </div>

      {/* 右上角: 电影级内嵌音频频谱仪 */}
      <div className="absolute top-2.5 right-3 hidden sm:flex flex-col items-end gap-1 pointer-events-none z-20">
        <span className="font-mono text-[8px] tracking-wider text-gold uppercase opacity-80">
          Neural Audio Visualizer · 48kHz
        </span>
        <div className="h-7 w-28 rounded-lg overflow-hidden border border-border bg-bg/80 p-0.5 backdrop-blur-md shadow-inner">
          <AudioVisualizerCanvas isPlaying={isPlaying} />
        </div>
      </div>

      {/* 视频主画幅 (动态比例与安全区层) */}
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-zinc-950 shadow-2xl border border-black/40 transition-all duration-300 ${getContainerRatioStyle()}`}
      >
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

            {/* 短剧防遮挡安全区网格 (Safe Zone Grid) */}
            {showSafeZone && aspectRatio === "9:16" && (
              <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-between p-1.5 animate-fade-in select-none">
                {/* 顶部防遮挡区域 (关注/搜索栏) */}
                <div className="h-6 w-full border-b border-dashed border-red-500/40 bg-red-500/5 flex items-center justify-center">
                  <span className="text-[7px] font-mono text-red-400 opacity-60">
                    顶部交互避让区
                  </span>
                </div>

                {/* 画面中心黄金交叉标线 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4 h-[1px] bg-gold/40" />
                  <div className="h-4 w-[1px] bg-gold/40 absolute" />
                </div>

                {/* 右侧互动按钮区 (头像/点赞/评论/转发) */}
                <div className="absolute right-1 bottom-14 top-10 w-6 border-l border-dashed border-amber-500/40 bg-amber-500/5 flex flex-col items-center justify-around py-1">
                  <span className="text-[6px] font-mono text-amber-400 opacity-60 [writing-mode:vertical-rl]">
                    右侧互动区
                  </span>
                </div>

                {/* 底部标题文案区 (用户ID/解说文案/声音胶盘) */}
                <div className="h-12 w-full border-t border-dashed border-red-500/40 bg-red-500/5 flex items-center justify-center">
                  <span className="text-[7px] font-mono text-red-400 opacity-60">
                    底部标题/声音避让区
                  </span>
                </div>

                {/* 推荐安全字幕投放框 */}
                <div className="absolute bottom-14 left-2 right-8 h-8 border border-emerald-500/60 bg-emerald-500/10 rounded flex items-center justify-center">
                  <span className="text-[7px] font-mono text-emerald-400 font-bold">
                    🎯 黄金字幕区 (Safe)
                  </span>
                </div>
              </div>
            )}

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
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-mono text-gold backdrop-blur-md pointer-events-none z-10">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {activeSceneIndex ? `镜 ${activeSceneIndex} · ` : ""}
            {aspectRatio} ({resolutionText})
          </span>
        </div>

        {/* 画面中央播放快捷覆盖层 */}
        {hasUploadedVideo && (
          <button
            type="button"
            onClick={onTogglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-10"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md shadow-lg">
              {isPlaying ? "⏸" : "▶"}
            </span>
          </button>
        )}
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
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2 z-10">
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

        {/* 播控倍速切换 */}
        <div className="flex items-center rounded-md bg-surface-elevated border border-border px-1 py-0.5 text-[9px] font-mono text-text-muted">
          {SPEED_OPTIONS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setPlaybackRate(rate)}
              className={`px-1 py-0.2 rounded transition-colors ${
                playbackRate === rate
                  ? "bg-gold text-zinc-950 font-bold"
                  : "hover:text-text-primary"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

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
