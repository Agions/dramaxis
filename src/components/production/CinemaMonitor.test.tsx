import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CinemaMonitor } from "./CinemaMonitor";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

describe("CinemaMonitor", () => {
  beforeEach(() => {
    // 模拟 HTMLMediaElement.prototype.play 和 pause
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  it("未导入主素材时展示导入引导并支持点击触发 onImportVideo", () => {
    const handleImport = vi.fn();
    render(
      <CinemaMonitor
        hasUploadedVideo={false}
        mediaPath={null}
        isPlaying={false}
        currentTime={0}
        duration={0}
        onTogglePlay={vi.fn()}
        onImportVideo={handleImport}
      />,
    );

    expect(screen.getByText("选择视频素材")).toBeInTheDocument();
    expect(screen.getByText(/9:16 短剧竖屏优先/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("选择视频素材"));
    expect(handleImport).toHaveBeenCalled();
  });

  it("已导入素材时挂载 video 元素并正确展示时长与播放控制", () => {
    const handleTogglePlay = vi.fn();
    const { container } = render(
      <CinemaMonitor
        hasUploadedVideo={true}
        mediaPath="/videos/short_drama.mp4"
        isPlaying={false}
        currentTime={15}
        duration={90}
        onTogglePlay={handleTogglePlay}
        onImportVideo={vi.fn()}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("asset:///videos/short_drama.mp4");

    // 格式化时间 15s -> 00:15 / 90s -> 01:30
    expect(screen.getByText("00:15 / 01:30")).toBeInTheDocument();

    // 播放按钮
    const playBtn = screen.getByTitle("播放 (Space)");
    fireEvent.click(playBtn);
    expect(handleTogglePlay).toHaveBeenCalled();
  });

  it("isPlaying 切换为 true 时调用 video.play()", () => {
    const { rerender } = render(
      <CinemaMonitor
        hasUploadedVideo={true}
        mediaPath="/videos/short_drama.mp4"
        isPlaying={false}
        currentTime={0}
        duration={90}
        onTogglePlay={vi.fn()}
        onImportVideo={vi.fn()}
      />,
    );

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    rerender(
      <CinemaMonitor
        hasUploadedVideo={true}
        mediaPath="/videos/short_drama.mp4"
        isPlaying={true}
        currentTime={0}
        duration={90}
        onTogglePlay={vi.fn()}
        onImportVideo={vi.fn()}
      />,
    );

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
