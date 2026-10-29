import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SceneCutsList, type SceneCut } from "./SceneCutsList";
import { detectIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  detectIpc: {
    analyzeScenesRag: vi.fn(),
    scenes: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn().mockReturnValue("toast-id"),
  },
}));

describe("SceneCutsList", () => {
  const onSetSceneCuts = vi.fn();
  const onSeek = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无切片时展示引导骨架", () => {
    render(
      <SceneCutsList
        sceneCuts={[]}
        onSetSceneCuts={onSetSceneCuts}
        mediaPath="/path/to/video.mp4"
        onSeek={onSeek}
      />,
    );

    expect(screen.getByText("暂无 Scene-RAG 切片数据")).toBeInTheDocument();
    expect(
      screen.getByText("载入视频后点击右上角「视听感知分析」提取镜头运动与情绪"),
    ).toBeInTheDocument();
  });

  it("有切片时渲染镜头卡片并支持点击跳转播放时间", () => {
    const mockCuts: SceneCut[] = [
      {
        id: 1,
        time: "00:00 - 00:05",
        tag: "开篇悬念镜头",
        emotion: "紧张",
        conflictScore: 88,
        motionIntensity: 75,
      },
      {
        id: 2,
        time: "00:05 - 00:12",
        tag: "角色冲突爆发",
        emotion: "激烈动作",
        conflictScore: 92,
        motionIntensity: 90,
      },
    ];

    render(
      <SceneCutsList
        sceneCuts={mockCuts}
        onSetSceneCuts={onSetSceneCuts}
        mediaPath="/path/to/video.mp4"
        onSeek={onSeek}
      />,
    );

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("开篇悬念镜头")).toBeInTheDocument();
    expect(screen.getByText("🔥 冲突 88%")).toBeInTheDocument();
    expect(screen.getByText("⚡ 动感 75")).toBeInTheDocument();

    // 点击第二个分镜卡片，应提取其起始秒数 00:05 = 5 并触发 onSeek
    fireEvent.click(screen.getByText("角色冲突爆发"));
    expect(onSeek).toHaveBeenCalledWith(5);
  });

  it("点击视听感知分析按钮成功触发 Scene-RAG 提取", async () => {
    vi.mocked(detectIpc.analyzeScenesRag).mockResolvedValueOnce([
      {
        sceneId: 1,
        startTime: 0.0,
        endTime: 4.5,
        duration: 4.5,
        keyframePath: null,
        motionIntensity: 85.0,
        emotionTag: "冲突",
        conflictScore: 90.0,
        visualSummary: "反转打脸镜头",
      },
    ] as any);

    render(
      <SceneCutsList
        sceneCuts={[]}
        onSetSceneCuts={onSetSceneCuts}
        mediaPath="/path/to/video.mp4"
        onSeek={onSeek}
      />,
    );

    fireEvent.click(screen.getByText("🔄 视听感知分析"));

    await waitFor(() => {
      expect(detectIpc.analyzeScenesRag).toHaveBeenCalledWith(
        "/path/to/video.mp4",
      );
    });

    expect(onSetSceneCuts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        tag: "反转打脸镜头",
        emotion: "冲突",
        conflictScore: 90,
      }),
    ]);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Scene-RAG 成功提取 1 组视听切片"),
      expect.anything(),
    );
  });
});
