/**
 * dramaxis v1.2.0 · useTimelineDerivedClips
 *
 * 领域纯计算 Hook:
 * 将 Workshop 产物 (分镜切片、配音时长、对齐规划、字幕) 转化为 5 轨磁性时间轴片段数据
 */

import { useMemo } from "react";
import { parseClock, parseTimeRange } from "@dramaxis/utils";
import type { AlignmentPlan, SceneVisualFeature } from "@dramaxis/ipc";
import type { SubtitleSegment, WorkshopSceneCut } from "@dramaxis/core";

export interface TimelineVideoClip {
  id: string;
  title: string;
  start: number;
  duration: number;
  emotion?: string;
  matchScore?: number;
  speedAdjustment?: number;
  isBroll?: boolean;
}

export interface TimelineVoiceClip {
  id: string;
  text: string;
  start: number;
  duration: number;
}

export interface UseTimelineDerivedClipsOptions {
  sceneCuts: WorkshopSceneCut[];
  alignmentPlan: AlignmentPlan | null;
  voiceAudioPath: string | null;
  voiceDuration: number;
  subtitleSegments: SubtitleSegment[];
  duration: number;
  hasUploadedVideo: boolean;
}

export function useTimelineDerivedClips({
  sceneCuts,
  alignmentPlan,
  voiceAudioPath,
  voiceDuration,
  duration,
  hasUploadedVideo,
}: UseTimelineDerivedClipsOptions) {
  // 解析场景数字时间戳
  const parsedSceneCuts = useMemo<number[]>(() => {
    return sceneCuts
      .map((sc) => {
        if (typeof sc.cutSec === "number") return sc.cutSec;
        if (sc.time.includes("-")) {
          const endStr = sc.time.split("-")[1]?.trim() ?? "";
          return parseClock(endStr);
        }
        return null;
      })
      .filter((n): n is number => typeof n === "number" && !isNaN(n));
  }, [sceneCuts]);

  // 视频切片集合
  const videoClips = useMemo<TimelineVideoClip[]>(() => {
    if (sceneCuts.length > 0) {
      return sceneCuts.map((c, idx) => {
        const { start, end: rawEnd } = parseTimeRange(c.time);
        const end = rawEnd ?? start + 15;
        const matched = alignmentPlan?.matches.find(
          (m) => m.matchedSceneId === c.id || m.scriptIndex === idx + 1,
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
      });
    }

    if (hasUploadedVideo) {
      return [
        {
          id: "v-1",
          title: "主摄短剧视频切片",
          start: 0,
          duration: duration || 100,
        },
      ];
    }

    return [];
  }, [sceneCuts, alignmentPlan, hasUploadedVideo, duration]);

  // 配音片段集合
  const voiceClips = useMemo<TimelineVoiceClip[]>(() => {
    if (!voiceAudioPath) return [];
    return [
      {
        id: "v-narration-1",
        text: `独白配音 (${voiceDuration.toFixed(1)}s)`,
        start: 0,
        duration: voiceDuration,
      },
    ];
  }, [voiceAudioPath, voiceDuration]);

  // 场景原始特征集 (供对齐调用)
  const rawSceneFeatures = useMemo<SceneVisualFeature[]>(() => {
    return sceneCuts
      .map((sc) => sc.rawFeature)
      .filter((f): f is SceneVisualFeature => Boolean(f));
  }, [sceneCuts]);

  return {
    parsedSceneCuts,
    videoClips,
    voiceClips,
    rawSceneFeatures,
  };
}
