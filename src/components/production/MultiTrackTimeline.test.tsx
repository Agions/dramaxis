import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiTrackTimeline } from "./MultiTrackTimeline";

describe("MultiTrackTimeline", () => {
  it("空状态时展示待命占位骨架", () => {
    render(
      <MultiTrackTimeline videoClips={[]} voiceClips={[]} hookClip={null} />,
    );
    expect(screen.getByText("多轨时间轴待命")).toBeInTheDocument();
    expect(
      screen.getByText(
        /导入素材或启动 Multi-Agent 智能体将实时排布 5 轨视听流/,
      ),
    ).toBeInTheDocument();
  });

  it("挂载视频分镜、高光钩子、配音音轨与字幕时完整渲染各轨道色块", () => {
    const videoClips = [
      { id: "v-1", title: "开篇悬念", start: 0, duration: 15, emotion: "高能" },
      {
        id: "v-2",
        title: "冲突爆发",
        start: 15,
        duration: 25,
        emotion: "紧张",
      },
    ];
    const hookClip = {
      title: "0~3s 黄金留存 Hook",
      start: 0,
      duration: 3,
      style: "dramatic",
    };
    const voiceClips = [
      {
        id: "a-1",
        text: "我叫林渊，三年前那场大火...",
        start: 0,
        duration: 28,
      },
    ];
    const subtitleClips = [
      { id: "sub-1", text: "我叫林渊", start: 0, duration: 3 },
      {
        id: "sub-2",
        text: "三年前那场大火彻底改变了命运",
        start: 3,
        duration: 4.5,
      },
    ];

    render(
      <MultiTrackTimeline
        durationSeconds={60}
        currentTime={10}
        videoClips={videoClips}
        hookClip={hookClip}
        voiceClips={voiceClips}
        subtitleClips={subtitleClips}
      />,
    );

    // 轨道标签
    expect(screen.getByText("V1 视频")).toBeInTheDocument();
    expect(screen.getByText("HK 高光")).toBeInTheDocument();
    expect(screen.getByText("A1 配音")).toBeInTheDocument();
    expect(screen.getByText("SUB 字幕")).toBeInTheDocument();
    expect(screen.getByText("BGM 伴奏")).toBeInTheDocument();

    // 视频切片
    expect(screen.getByText("开篇悬念")).toBeInTheDocument();
    expect(screen.getByText("高能")).toBeInTheDocument();
    expect(screen.getByText("冲突爆发")).toBeInTheDocument();

    // 钩子切片
    expect(screen.getByText("0~3s 黄金留存 Hook")).toBeInTheDocument();

    // 配音与字幕切片
    expect(screen.getByText(/我叫林渊，三年前那场大火/)).toBeInTheDocument();
    expect(screen.getByText("我叫林渊")).toBeInTheDocument();
    expect(
      screen.getByText("三年前那场大火彻底改变了命运"),
    ).toBeInTheDocument();
  });

  it("点击时间轴主网格区域时计算相对比例并触发 onSeek 回调", () => {
    const handleSeek = vi.fn();
    const { container } = render(
      <MultiTrackTimeline
        durationSeconds={120}
        currentTime={0}
        videoClips={[{ id: "v-1", title: "测试切片", start: 0, duration: 120 }]}
        onSeek={handleSeek}
      />,
    );

    const timelineContainer = container.querySelector(".cursor-crosshair");
    expect(timelineContainer).not.toBeNull();

    // 模拟容器宽度 1000px，点击位置 500px (即 50% = 60s)
    if (timelineContainer) {
      vi.spyOn(timelineContainer, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 200,
        width: 1000,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.click(timelineContainer, { clientX: 500 });
      expect(handleSeek).toHaveBeenCalledWith(60);
    }
  });

  it("支持缩放级别按钮切换并正确展示缩放比例", () => {
    render(
      <MultiTrackTimeline
        durationSeconds={60}
        videoClips={[{ id: "v-1", title: "测试切片", start: 0, duration: 60 }]}
      />,
    );

    expect(screen.getByText("100%")).toBeInTheDocument();

    const zoomInBtn = screen.getByText("+");
    fireEvent.click(zoomInBtn);
    expect(screen.getByText("125%")).toBeInTheDocument();

    const zoomOutBtn = screen.getByText("-");
    fireEvent.click(zoomOutBtn);
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("支持 BGM 闪避复选框切换并派发 onDuckingChange", () => {
    const handleDucking = vi.fn();
    render(
      <MultiTrackTimeline
        durationSeconds={60}
        autoDucking={true}
        bgmMixRatio={18}
        onDuckingChange={handleDucking}
        videoClips={[{ id: "v-1", title: "切片", start: 0, duration: 60 }]}
      />,
    );

    expect(screen.getByText("BGM 闪避 (-18%)")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(handleDucking).toHaveBeenCalledWith(false);
  });

  it("支持 NLE 工业级轨道头 Mute / Solo / Lock 切换控制并派发 onTrackControlChange", () => {
    const handleControlChange = vi.fn();
    render(
      <MultiTrackTimeline
        durationSeconds={60}
        onTrackControlChange={handleControlChange}
        videoClips={[{ id: "v-1", title: "切片一", start: 0, duration: 30 }]}
      />,
    );

    const v1MuteBtn = screen.getByLabelText("V1-mute");
    const v1SoloBtn = screen.getByLabelText("V1-solo");
    const v1LockBtn = screen.getByLabelText("V1-lock");

    expect(v1MuteBtn).toBeInTheDocument();
    expect(v1SoloBtn).toBeInTheDocument();
    expect(v1LockBtn).toBeInTheDocument();

    fireEvent.click(v1MuteBtn);
    expect(handleControlChange).toHaveBeenCalledWith("V1", "muted", true);

    fireEvent.click(v1SoloBtn);
    expect(handleControlChange).toHaveBeenCalledWith("V1", "solo", true);

    fireEvent.click(v1LockBtn);
    expect(handleControlChange).toHaveBeenCalledWith("V1", "locked", true);
  });

  it("点击时间轴片段能够触发选中高亮并寻道至片段起点", () => {
    const handleSelectClip = vi.fn();
    const handleSeek = vi.fn();

    render(
      <MultiTrackTimeline
        durationSeconds={60}
        onSelectClip={handleSelectClip}
        onSeek={handleSeek}
        videoClips={[{ id: "v-alpha", title: "高光片段", start: 12, duration: 15 }]}
      />,
    );

    const clipElement = screen.getByText("高光片段");
    fireEvent.click(clipElement);

    expect(handleSelectClip).toHaveBeenCalledWith("v-alpha");
    expect(handleSeek).toHaveBeenCalledWith(12);
  });

  it("支持键盘左右箭头对时间轴进行精细单帧/步进寻道", () => {
    const handleSeek = vi.fn();
    const { container } = render(
      <MultiTrackTimeline
        durationSeconds={60}
        currentTime={10}
        onSeek={handleSeek}
        videoClips={[{ id: "v-1", title: "测试", start: 0, duration: 60 }]}
      />,
    );

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).not.toBeNull();

    // 单步后退 (10s - 0.2s = 9.8s)
    fireEvent.keyDown(rootElement, { key: "ArrowLeft" });
    expect(handleSeek).toHaveBeenCalledWith(9.8);

    // 单步前进 (10s + 0.2s = 10.2s)
    fireEvent.keyDown(rootElement, { key: "ArrowRight" });
    expect(handleSeek).toHaveBeenCalledWith(10.2);

    // 按住 Shift 粗调后退 (10s - 1.0s = 9.0s)
    fireEvent.keyDown(rootElement, { key: "ArrowLeft", shiftKey: true });
    expect(handleSeek).toHaveBeenCalledWith(9);
  });

  it("支持 Space 键触发播放/暂停，支持 Home/End 跳至首尾", () => {
    const handleTogglePlay = vi.fn();
    const handleSeek = vi.fn();
    const { container } = render(
      <MultiTrackTimeline
        durationSeconds={120}
        currentTime={50}
        onSeek={handleSeek}
        onTogglePlay={handleTogglePlay}
        videoClips={[{ id: "v-1", title: "测试", start: 0, duration: 120 }]}
      />,
    );

    const rootElement = container.firstChild as HTMLElement;

    // 空格切换播放
    fireEvent.keyDown(rootElement, { code: "Space" });
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);

    // Home 跳至片头 0s
    fireEvent.keyDown(rootElement, { key: "Home" });
    expect(handleSeek).toHaveBeenCalledWith(0);

    // End 跳至片尾 120s
    fireEvent.keyDown(rootElement, { key: "End" });
    expect(handleSeek).toHaveBeenCalledWith(120);
  });

  it("支持 I/O 键设定入出点并渲染高光选区遮罩", () => {
    const handleMarkChange = vi.fn();
    const { container } = render(
      <MultiTrackTimeline
        durationSeconds={100}
        currentTime={20}
        onMarkChange={handleMarkChange}
        markIn={10}
        markOut={40}
        videoClips={[{ id: "v-1", title: "测试", start: 0, duration: 100 }]}
      />,
    );

    expect(screen.getByText(/选区: 00:10.0 - 00:40.0/)).toBeInTheDocument();
    expect(screen.getByText("IN 00:10.0")).toBeInTheDocument();
    expect(screen.getByText("OUT 00:40.0")).toBeInTheDocument();

    const rootElement = container.firstChild as HTMLElement;
    // 按 I 设定入点
    fireEvent.keyDown(rootElement, { key: "i" });
    expect(handleMarkChange).toHaveBeenCalledWith(20, 40);
  });
});
