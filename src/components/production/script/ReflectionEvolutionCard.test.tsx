import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReflectionEvolutionCard } from "./ReflectionEvolutionCard";
import type { Blackboard } from "@dramaxis/ipc";

vi.mock("@dramaxis/ipc", () => ({
  agentIpc: {
    rollbackScript: vi.fn().mockResolvedValue(true),
  },
}));

describe("ReflectionEvolutionCard", () => {
  const mockBlackboard: Blackboard = {
    sessionId: "test-session-1",
    createdAt: 1700000000,
    visualBrief: null,
    audioBrief: null,
    voiceArtifact: null,
    timelineArtifact: null,
    qualityReport: null,
    activeScriptIndex: 1,
    scriptVersions: [
      {
        version: 1,
        authorAgent: "screenwriter",
        promptUsed: "prompt-v1",
        text: "这是第一版解说文案，缺少悬念冲突。",
        hookType: "conflict",
        hookText: "这是第一版",
        estimatedRetention: 74.0,
        hookScore: 70.0,
        pacingScore: 78.0,
        conflictScore: 72.0,
        critiqueFeedback: "开篇平铺直叙，建议加强反转",
        critiqueSuggestions: ["加入突发危机", "字数删减10%"],
        createdAt: 1700000100,
      },
      {
        version: 2,
        authorAgent: "screenwriter",
        promptUsed: "prompt-v2",
        text: "我万万没想到，深夜推开这扇门，所有真相早已被调包！",
        hookType: "cliffhanger",
        hookText: "我万万没想到",
        estimatedRetention: 92.0,
        hookScore: 94.0,
        pacingScore: 90.0,
        conflictScore: 91.0,
        critiqueFeedback: "张力优秀，黄金前3秒抓人",
        critiqueSuggestions: [],
        createdAt: 1700000200,
      },
    ],
  };

  it("当黑板没有剧本版本时不渲染卡片", () => {
    const { container } = render(<ReflectionEvolutionCard blackboard={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("正确渲染多轮版本徽章与当前激活版本指标", () => {
    render(<ReflectionEvolutionCard blackboard={mockBlackboard} />);

    expect(screen.getByText(/剧本自反思演化轨迹/)).toBeInTheDocument();
    expect(screen.getByText("共 2 轮")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /v1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /v2/ })).toBeInTheDocument();

    // 默认展示 activeScriptIndex = 1 (v2)
    expect(screen.getByText("第 2 轮产物评估")).toBeInTheDocument();
    expect(screen.getByText("92.0")).toBeInTheDocument();
    expect(screen.getByText("张力优秀，黄金前3秒抓人")).toBeInTheDocument();
  });

  it("点击切换至 v1 时展示上一轮批注与回滚按钮", () => {
    render(<ReflectionEvolutionCard blackboard={mockBlackboard} />);

    const v1Btn = screen.getByRole("button", { name: /v1/ });
    fireEvent.click(v1Btn);

    expect(screen.getByText("第 1 轮产物评估")).toBeInTheDocument();
    expect(screen.getByText("74.0")).toBeInTheDocument();
    expect(screen.getByText("开篇平铺直叙，建议加强反转")).toBeInTheDocument();
    expect(screen.getByText("加入突发危机")).toBeInTheDocument();
    expect(screen.getByText("↺ 回滚至此版")).toBeInTheDocument();
  });
});
