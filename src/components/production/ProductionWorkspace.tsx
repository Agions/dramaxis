/**
 * dramaxis v1.1.0 · 生产工作台中央监视器与时间轴工作区 (ProductionWorkspace)
 *
 * 核心功能:
 * - 居中专业视听监看台 (CinemaMonitor)
 * - 5 轨毫秒级磁性时间轴 (MultiTrackTimeline)
 * - 结合 usePlaybackStore 隔离 60fps 播放事件对全局侧边栏与表单的重渲染
 * - 结合 useWorkshopStore 提供声画对齐微调、B-roll、音轨和场景特征
 */

import { memo, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { CinemaMonitor } from "@components/production/CinemaMonitor";
import { MultiTrackTimeline } from "@components/production/MultiTrackTimeline";
import { usePlaybackStore, useWorkshopStore } from "@dramaxis/core";
import { pipelineIpc, type SceneVisualFeature } from "@dramaxis/ipc";

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

  // 解析分镜数字时间戳
  const parsedSceneCuts = useMemo(() => {
    return sceneCuts
      .map((sc) => {
        if (typeof sc.cutSec === "number") return sc.cutSec;
        if (sc.time.includes("-")) {
          const parts = sc.time.split("-");
          const endStr = parts[1]?.trim() ?? "";
          const [m, s] = endStr.split(":").map(Number);
          return (m || 0) * 60 + (s || 0);
        }
        return null;
      })
      .filter((n): n is number => typeof n === "number" && !isNaN(n));
  }, [sceneCuts]);

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
    <main className="flex flex-col border-r border-border bg-bg p-3 gap-3 overflow-y-auto">
      {/* 上半部分: 居中专业视听监看台 */}
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

      {/* 下半部分: 5 轨专业磁性时间轴 */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-surface overflow-hidden shadow-md">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface-elevated/50">
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

        <div className="flex-1 overflow-hidden p-2">
          <MultiTrackTimeline
            currentTime={currentTime}
            durationSeconds={duration}
            isPlaying={isPlaying}
            onSeek={seek}
            subtitleClips={subtitleSegments}
            alignmentPlan={alignmentPlan}
            onAutoAlign={handleAutoAlign}
            isAligning={isAligning}
            voiceClips={
              voiceAudioPath
                ? [
                    {
                      id: "v-narration-1",
                      text: `独白配音 (${voiceDuration.toFixed(1)}s)`,
                      start: 0,
                      duration: voiceDuration,
                    },
                  ]
                : []
            }
            videoClips={
              sceneCuts.length > 0
                ? sceneCuts.map((c, idx) => {
                    const parts = c.time.split(" - ").map((t) => {
                      const [m, s] = t.split(":").map(Number);
                      return (m || 0) * 60 + (s || 0);
                    });
                    const start = parts[0] ?? 0;
                    const end = parts[1] ?? start + 15;
                    const matched = alignmentPlan?.matches.find(
                      (m) =>
                        m.matchedSceneId === c.id || m.scriptIndex === idx + 1,
                    );
                    return {
                      id: `v-clip-${c.id}`,
                      title: c.tag,
                      start,
                      duration: Math.max(1, end - start),
                      emotion: c.emotion,
                      matchScore: matched?.matchScore,
                      speedAdjustment: matched?.speedAdjustment,
                      isBroll: matched?.isBrollInserted,
                    };
                  })
                : hasUploadedVideo
                  ? [
                      {
                        id: "v-1",
                        title: "主摄短剧视频切片",
                        start: 0,
                        duration: duration || 100,
                      },
                    ]
                  : []
            }
          />
        </div>
      </div>
    </main>
  );
});
