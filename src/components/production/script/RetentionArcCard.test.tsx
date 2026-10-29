import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RetentionArcCard } from "./RetentionArcCard";
import { scriptIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  scriptIpc: {
    calculateRetentionArc: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("RetentionArcCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始未分析时展示测评引导文案", () => {
    render(<RetentionArcCard scriptText="" />);
    expect(
      screen.getByText(/留存曲线张力分析/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("生成或输入文案后，点击右上角「⚡ 测评留存波形」评估完播留存张力。"),
    ).toBeInTheDocument();
  });

  it("文案存在时点击测评波形成功渲染四维指标与完播指数", async () => {
    const mockArc = {
      overallRetentionIndex: 88.6,
      hookScore: 92.0,
      setupEmpathyScore: 85.0,
      climaxIntensity: 90.0,
      cliffhangerRetention: 87.5,
      curvePoints: [
        { timeSec: 0, tensionLevel: 92 },
        { timeSec: 15, tensionLevel: 78 },
        { timeSec: 45, tensionLevel: 95 },
        { timeSec: 60, tensionLevel: 88 },
      ],
    };
    vi.mocked(scriptIpc.calculateRetentionArc).mockResolvedValueOnce(mockArc as any);

    render(<RetentionArcCard scriptText="这是一段精彩的短剧独白文案..." />);

    fireEvent.click(screen.getByText("⚡ 测评留存波形"));

    await waitFor(() => {
      expect(screen.getByText("88.6% 完播可能")).toBeInTheDocument();
      expect(screen.getByText("92%")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
      expect(screen.getByText("88%")).toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith(
      "留存曲线计算完成！综合留存指数: 88.6%",
    );
  });
});
