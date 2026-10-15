import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportStudioPanel } from "./ExportStudioPanel";
import { exportIpc, type ProjectRecord } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  exportIpc: {
    capcutDraft: vi.fn(),
    renderVideo: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ExportStudioPanel", () => {
  const mockProject: ProjectRecord = {
    path: "/projects/sample.splicr",
    project: {
      id: "proj_test_1",
      name: "千万短剧项目",
      created_at: "2026-09-22T00:00:00Z",
      updated_at: "2026-09-22T00:00:00Z",
      version: "1.0.1",
      settings: {
        resolution: "1080x1920",
        fps: 30,
        bitrate: "8000k",
        container: "mp4",
        codec: "libx264",
        four_strategy: "single",
      },
      media_files: [
        {
          path: "/media/video.mp4",
          duration_seconds: 45,
          resolution: "1080x1920",
          codec: "h264",
          file_size_bytes: 10485760,
          import_time: "2026-09-22T00:00:00Z",
        },
      ],
      timeline: {
        tracks: [],
      },
      scripts: [],
      exports: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染剪映草稿导出卡片与防重参数控制组件", () => {
    render(
      <ExportStudioPanel
        currentProject={mockProject}
        antiDupZoom={1.03}
        onAntiDupZoomChange={vi.fn()}
        enableAmbientBlur={true}
        onEnableAmbientBlurChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("剪映 PC 原生工程草稿 (.draft)"),
    ).toBeInTheDocument();
    expect(screen.getByText("一键导出至剪映草稿库")).toBeInTheDocument();
    expect(screen.getByText("高完播率防重矩阵 (Anti-Dup)")).toBeInTheDocument();
    expect(screen.getByText("1.03x")).toBeInTheDocument();
    expect(screen.getByText("9:16 竖屏高斯模糊环境底衬")).toBeInTheDocument();
  });

  it("点击剪映导出按钮成功触发 exportIpc.capcutDraft 并传递真实多轨数据", async () => {
    vi.mocked(exportIpc.capcutDraft).mockResolvedValueOnce({
      draftFolder:
        "/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/splicr_123",
      draftId: "splicr_123",
      createdAt: "2026-09-22T10:00:00Z",
      isJianyingInstalled: true,
      totalDurationSeconds: 45,
    });

    render(
      <ExportStudioPanel
        currentProject={mockProject}
        antiDupZoom={1.04}
        onAntiDupZoomChange={vi.fn()}
        enableAmbientBlur={true}
        onEnableAmbientBlurChange={vi.fn()}
        voiceAudioPath="/audio/narration.mp3"
        voiceDuration={30}
        subtitles={[{ id: "sub-1", text: "第一句台词", start: 0, duration: 3 }]}
        sceneCuts={[
          { id: 1, time: "00:00 - 00:15", tag: "开篇", emotion: "高能" },
        ]}
      />,
    );

    const exportBtn = screen.getByText("一键导出至剪映草稿库");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportIpc.capcutDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: "千万短剧项目",
          videoPath: "/media/video.mp4",
          videoDurationSeconds: 45,
          voicePath: "/audio/narration.mp3",
          voiceDurationSeconds: 30,
          antiDupZoom: 1.04,
          enableAmbientBlur: true,
          subtitles: [{ text: "第一句台词", start: 0, end: 3 }],
          sceneCuts: [15],
        }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("剪映草稿工程已直接同步至剪映首页"),
        expect.any(Object),
      );
    });
  });

  it("点击平台预设按钮成功触发 exportIpc.renderVideo 硬件加速压制", async () => {
    vi.mocked(exportIpc.renderVideo).mockResolvedValueOnce({
      outputPath: "/downloads/splicr_douyin.mp4",
      durationSeconds: 45,
      sizeBytes: 25 * 1024 * 1024,
    });

    render(
      <ExportStudioPanel
        currentProject={mockProject}
        antiDupZoom={1.03}
        onAntiDupZoomChange={vi.fn()}
        enableAmbientBlur={true}
        onEnableAmbientBlurChange={vi.fn()}
        voiceAudioPath="/audio/voice.mp3"
        voiceDuration={28}
      />,
    );

    const douyinBtn = screen.getByText("抖音 / TikTok (9:16)");
    fireEvent.click(douyinBtn);

    await waitFor(() => {
      expect(exportIpc.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoPath: "/media/video.mp4",
          voicePath: "/audio/voice.mp3",
          platformPreset: "抖音 / TikTok (9:16)",
          antiDupZoom: 1.03,
          enableAmbientBlur: true,
        }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("抖音 / TikTok (9:16) 格式压制渲染成功"),
        expect.any(Object),
      );
    });
  });

  it("调节防重缩放与环境模糊时调用相应的 change 回调", () => {
    const handleZoom = vi.fn();
    const handleBlur = vi.fn();

    render(
      <ExportStudioPanel
        currentProject={mockProject}
        antiDupZoom={1.02}
        onAntiDupZoomChange={handleZoom}
        enableAmbientBlur={false}
        onEnableAmbientBlurChange={handleBlur}
      />,
    );

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "1.06" } });
    expect(handleZoom).toHaveBeenCalledWith(1.06);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(handleBlur).toHaveBeenCalledWith(true);
  });
});
