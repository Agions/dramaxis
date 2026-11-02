import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTimelineDerivedClips } from "./useTimelineDerivedClips";
import type { WorkshopSceneCut } from "@dramaxis/core";

describe("useTimelineDerivedClips", () => {
  it("无切片但有主素材时，返回兜底主摄视频片段", () => {
    const { result } = renderHook(() =>
      useTimelineDerivedClips({
        sceneCuts: [],
        alignmentPlan: null,
        voiceAudioPath: null,
        voiceDuration: 0,
        subtitleSegments: [],
        duration: 80,
        hasUploadedVideo: true,
      }),
    );

    expect(result.current.videoClips).toHaveLength(1);
    expect(result.current.videoClips[0]?.id).toBe("v-1");
    expect(result.current.videoClips[0]?.duration).toBe(80);
    expect(result.current.voiceClips).toHaveLength(0);
    expect(result.current.parsedSceneCuts).toEqual([]);
  });

  it("存在分镜切片与配音时，正确派生对应轨道片段与解析秒数", () => {
    const mockCuts: WorkshopSceneCut[] = [
      {
        id: 1,
        time: "00:00 - 00:05",
        tag: "高能反转",
        emotion: "紧张",
        cutSec: 5,
      },
      {
        id: 2,
        time: "00:05 - 00:15",
        tag: "真相逼近",
        emotion: "悬疑",
        cutSec: 15,
      },
    ];

    const { result } = renderHook(() =>
      useTimelineDerivedClips({
        sceneCuts: mockCuts,
        alignmentPlan: null,
        voiceAudioPath: "/audio/voice.mp3",
        voiceDuration: 14.5,
        subtitleSegments: [],
        duration: 30,
        hasUploadedVideo: true,
      }),
    );

    expect(result.current.parsedSceneCuts).toEqual([5, 15]);
    expect(result.current.videoClips).toHaveLength(2);
    expect(result.current.videoClips[0]?.title).toBe("高能反转");
    expect(result.current.videoClips[0]?.duration).toBe(5);
    expect(result.current.videoClips[1]?.start).toBe(5);
    expect(result.current.videoClips[1]?.duration).toBe(10);

    expect(result.current.voiceClips).toHaveLength(1);
    expect(result.current.voiceClips[0]?.text).toContain("14.5s");
  });
});
