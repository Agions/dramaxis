/**
 * dramaxis v1.2.0 · 生产工作台中央监视器与时间轴工作区 (ProductionWorkspace)
 *
 * 核心升级:
 * - 采用 useTimelineDerivedClips 专属纯计算 Hook，消除重复繁重的分镜切片转换
 * - 居中专业视听监看台 (CinemaMonitor) 与 5 轨磁性时间轴 (MultiTrackTimeline)
 * - 响应式垂直 Splitter: 支持拖拽或预设档位调节监看台与时间轴纵向视口比例，自适应 1080P/2K/4K 屏幕
 * - 结合 usePlaybackStore 隔离 60fps 播放事件对全局侧边栏与表单的重渲染
 * - 结合 useWorkshopStore 提供声画对齐微调、B-roll、音轨和场景特征
 */

import { memo, useCallback, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { CinemaMonitor } from "@components/production/CinemaMonitor";
import { MultiTrackTimeline } from "@components/production/MultiTrackTimeline";
import { usePlaybackStore, useWorkshopStore } from "@dramaxis/core";
import { pipelineIpc, type SceneVisualFeature } from "@dramaxis/ipc";
import { useTimelineDerivedClips } from "../../hooks/useTimelineDerivedClips";

interface ProductionWorkspaceProps {
  hasUploadedVideo: boolean;
  mediaPath?: string | null;
  onImportVideo: () => void;
}

export const ProductionWorkspace = memo(function ProductionWorkspace({
  hasUploadedVideo,
  mediaPath,
  onImportVideo,
}: ProductionWorkspaceProps) {
  // 1. 高频播放时钟状态隔离
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const seek = usePlaybackStore((s) => s.seek);

  // 2. 工坊领域数据状态
  const sceneCuts = useWorkshopStore((s) => s.sceneCuts);
  const subtitleSegments = useWorkshopStore((s) => s.subtitleSegments);
  const voiceAudioPath = useWorkshopStore((s) => s.voiceAudioPath);
  const voiceDuration = useWorkshopStore((s) => s.voiceDuration);
  const bgmPath = useWorkshopStore((s) => s.bgmPath);
  const bgmVolume = useWorkshopStore((s) => s.bgmVolume);
  const enableAudioDucking = useWorkshopStore((s) => s.enableAudioDucking);
  const subtitleStyle = useWorkshopStore((s) => s.subtitleStyle);
  const scriptText = useWorkshopStore((s) => s.scriptText);
  const alignmentPlan = useWorkshopStore((s) => s.alignmentPlan);
  const isAligning = useWorkshopStore((s) => s.isAligning);
  const setAlignmentPlan = useWorkshopStore((s) => s.setAlignmentPlan);
  const setIsAligning = useWorkshopStore((s) => s.setIsAligning);

  // 3. 时间轴派生数据下沉 (useTimelineDerivedClips)
  const { parsedSceneCuts, videoClips, voiceClips } = useTimelineDerivedClips({
    sceneCuts,
    alignmentPlan,
    voiceAudioPath,
    voiceDuration,
    subtitleSegments,
    duration,
    hasUploadedVideo,
  });

  // 4. 监看台与时间轴纵向视口 Splitter 比例控制 (默认 42% 时间轴高度)
  const [timelinePercent, setTimelinePercent] = useState<number>(42);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalHeight = rect.height;
      if (totalHeight <= 0) return;

      const monitorRatio = relativeY / totalHeight;
      const nextTimelinePercent = Math.max(
        22,
        Math.min(68, Math.round((1 - monitorRatio) * 100)),
      );
      setTimelinePercent(nextTimelinePercent);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // 语义与情绪双驱动声画对齐
  const handleAutoAlign = useCallback(async () => {
    if (sceneCuts.length === 0 || !scriptText.trim()) {
      toast.warning("需同时具备镜头切片与剧本文案方可进行声画对齐");
      return;
    }
    setIsAligning(true);
    const toastId = toast.loading("正在执行语义与情绪双驱动声画对齐...");
    try {
      const rawScenes = sceneCuts
        .map((sc) => sc.rawFeature)
        .filter(Boolean) as SceneVisualFeature[];
      const lines = scriptText
        .split(/[\n。！？]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const plan = await pipelineIpc.alignScriptWithScenes(
        rawScenes,
        lines,
        voiceDuration || duration,
      );
      setAlignmentPlan(plan);
      toast.success(
        `声画时空对齐完成！整体契合指数: ${plan.overallSyncScore.toFixed(0)}%`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(`声画对齐失败: ${String(e)}`, { id: toastId });
    } finally {
      setIsAligning(false);
    }
  }, [
    sceneCuts,
    scriptText,
    voiceDuration,
    duration,
    setAlignmentPlan,
    setIsAligning,
  ]);

  return (
    <main
      ref={workspaceRef}
      className={`relative flex flex-col h-full border-r border-border bg-bg p-3 gap-2 overflow-hidden ${
        isDraggingSplitter ? "select-none cursor-row-resize" : ""
      }`}
    >
      {/* 上半部分: 居中专业视听监看台 */}
      <div
        className="flex-1 flex flex-col min-h-0 overflow-y-auto"
        style={{ flexBasis: `${100 - timelinePercent}%` }}
      >
        <CinemaMonitor
          hasUploadedVideo={hasUploadedVideo}
          mediaPath={mediaPath ?? null}
          voiceAudioPath={voiceAudioPath}
          voiceDuration={voiceDuration}
          bgmAudioPath={bgmPath}
          bgmVolume={bgmVolume}
          bgmDuckingLevel={0.18}
          enableAudioDucking={enableAudioDucking}
          subtitles={subtitleSegments}
          subtitleStyle={subtitleStyle}
          sceneCuts={parsedSceneCuts}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={togglePlay}
          onImportVideo={onImportVideo}
          onTimeUpdate={setCurrentTime}
          onDurationChange={setDuration}
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* 中间: 响应式视口 Splitter 拖拽条与预设档位 */}
      <div
        onMouseDown={handleSplitterMouseDown}
        className={`group relative flex items-center justify-between px-3 py-1 -my-0.5 rounded cursor-row-resize transition-all ${
          isDraggingSplitter
            ? "bg-gold/30 shadow-[0_0_12px_rgba(234,179,8,0.5)]"
            : "hover:bg-surface-elevated border-y border-transparent hover:border-border/60"
        }`}
      >
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-gold/70" />
          <span>布局调节 (时间轴 {timelinePercent}%)</span>
        </div>

        {/* 居中把手横线 */}
        <div className="w-16 h-1 rounded-full bg-border group-hover:bg-gold/80 transition-colors" />

        {/* 预设档位快捷键 */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="聚焦监视器 (30%)"
            onClick={() => setTimelinePercent(30)}
            className={`px-1.5 py-0.2 rounded text-[8px] font-mono border transition-all ${
              timelinePercent <= 32
                ? "bg-gold/20 border-gold text-gold"
                : "border-border/60 text-text-muted hover:text-text-primary"
            }`}
          >
            监视器优先
          </button>
          <button
            type="button"
            title="均衡模式 (42%)"
            onClick={() => setTimelinePercent(42)}
            className={`px-1.5 py-0.2 rounded text-[8px] font-mono border transition-all ${
              timelinePercent > 32 && timelinePercent < 55
                ? "bg-gold/20 border-gold text-gold"
                : "border-border/60 text-text-muted hover:text-text-primary"
            }`}
          >
            均衡
          </button>
          <button
            type="button"
            title="聚焦多轨时间轴 (58%)"
            onClick={() => setTimelinePercent(58)}
            className={`px-1.5 py-0.2 rounded text-[8px] font-mono border transition-all ${
              timelinePercent >= 55
                ? "bg-gold/20 border-gold text-gold"
                : "border-border/60 text-text-muted hover:text-text-primary"
            }`}
          >
            多轨精剪
          </button>
        </div>
      </div>

      {/* 下半部分: 5 轨专业磁性时间轴 */}
      <div
        className="flex flex-col min-h-0 rounded-2xl border border-border bg-surface overflow-hidden shadow-md"
        style={{
          flexBasis: `${timelinePercent}%`,
          height: `${timelinePercent}%`,
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface-elevated/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              5 轨毫秒级磁性时间轴 (MultiTrack Timeline)
            </span>
            <span className="rounded bg-surface border border-border px-1.5 py-0.2 font-mono text-[9px] text-gold font-bold">
              &lt;18ms 吸附精度
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-muted">
            V1 视频轨 · A1 配音轨 · A2 动态BGM · T1 智能字幕 · FX 特效
          </span>
        </div>

        <div className="flex-1 overflow-hidden p-2 min-h-0">
          <MultiTrackTimeline
            currentTime={currentTime}
            durationSeconds={duration}
            isPlaying={isPlaying}
            onSeek={seek}
            onTogglePlay={togglePlay}
            subtitleClips={subtitleSegments}
            alignmentPlan={alignmentPlan}
            onAutoAlign={handleAutoAlign}
            isAligning={isAligning}
            voiceClips={voiceClips}
            videoClips={videoClips}
          />
        </div>
      </div>
    </main>
  );
});
