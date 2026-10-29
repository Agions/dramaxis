import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HookEngineCard } from "./HookEngineCard";
import { scriptIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  scriptIpc: {
    generateHooks: vi.fn(),
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

describe("HookEngineCard", () => {
  const onApplyHookText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始状态展示留存提示文案", () => {
    render(
      <HookEngineCard
        userPrompt="悬疑故事"
        scriptText=""
        onApplyHookText={onApplyHookText}
      />,
    );
    expect(screen.getByText("🎯 黄金 3 秒爆款 Hook 引擎")).toBeInTheDocument();
    expect(
      screen.getByText("短视频算法完播率关键在于前 3 秒！"),
    ).toBeInTheDocument();
  });

  it("点击推导按钮成功渲染候选卡片并支持采纳开场", async () => {
    const mockHooks = [
      {
        formula: "result_first",
        formulaName: "结果前置型 (高潮前置)",
        hookText: "他竟亲手毁掉了自己守护的一切！",
        estimatedRetentionScore: 95.0,
        strategyReason: "极度吸引悬疑受众",
      },
    ];
    vi.mocked(scriptIpc.generateHooks).mockResolvedValueOnce(mockHooks as any);

    render(
      <HookEngineCard
        userPrompt="反转剧本"
        scriptText="正文开始..."
        onApplyHookText={onApplyHookText}
      />,
    );

    fireEvent.click(screen.getByText("⚡ 一键推导 4 大公式"));

    await waitFor(() => {
      expect(screen.getByText("结果前置型 (高潮前置)")).toBeInTheDocument();
      expect(screen.getByText("95% 预估留存")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("采纳开场"));
    expect(onApplyHookText).toHaveBeenCalledWith(
      "他竟亲手毁掉了自己守护的一切！\n\n正文开始...",
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已采纳【结果前置型 (高潮前置)】为黄金 3 秒开场！",
    );
  });
});
