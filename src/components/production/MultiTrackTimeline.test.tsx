import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiTrackTimeline } from "./MultiTrackTimeline";

describe("MultiTrackTimeline", () => {
  it("空状态时展示待命占位骨架", () => {
    render(<MultiTrackTimeline videoClips={[]} voiceClips={[]} hookClip={null} />);
    expect(screen.getByText("多轨时间轴待命")).toBeInTheDocument();
    expect(
      screen.getByText(/导入素材或启动 Multi-Agent 智能体将实时排布 5 轨视听流/),
    ).toBeInTheDocument();
  });

  it("挂载视频分镜、高光钩子、配音音轨与字幕时完整渲染各轨道色块", () => {
    const videoClips = [
      { id: "v-1", title: "开篇悬念", start: 0, duration: 15, emotion: "高能" },
      { id: "v-2", title: "冲突爆发", start: 15, duration: 25, emotion: "紧张" },
    ];
    const hookClip = {
      title: "0~3s 黄金留存 Hook",
      start: 0,
      duration: 3,
      style: "dramatic",
    };
    const voiceClips = [
      { id: "a-1", text: "我叫林渊，三年前那场大火...", start: 0, duration: 28 },
    ];
    const subtitleClips = [
      { id: "sub-1", text: "我叫林渊", start: 0, duration: 3 },
      { id: "sub-2", text: "三年前那场大火彻底改变了命运", start: 3, duration: 4.5 },
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
    expect(screen.getByText("三年前那场大火彻底改变了命运")).toBeInTheDocument();
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
});
