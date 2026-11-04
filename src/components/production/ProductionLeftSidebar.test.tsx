import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionLeftSidebar } from "./ProductionLeftSidebar";
import type { DagSnapshot } from "@dramaxis/ipc";

vi.mock("@dramaxis/core", () => ({
  usePlaybackStore: () => vi.fn(),
  useWorkshopStore: () => [],
}));

vi.mock("./SceneCutsList", () => ({
  SceneCutsList: () => <div data-testid="scene-cuts-mock">SceneCutsList</div>,
}));

describe("ProductionLeftSidebar", () => {
  it("针对不同工作流模板动态渲染对应数量的预期 DAG 节点", () => {
    // 1. 高光混剪 (4 节点)
    const { rerender } = render(
      <ProductionLeftSidebar
        currentStepIndex={0}
        workflowProfile="pure_broll_montage"
      />,
    );
    expect(screen.getByText(/DAG 流水线 \(0\/4\)/)).toBeInTheDocument();
    expect(screen.getByText("高光混剪结构规划")).toBeInTheDocument();

    // 2. 极速解说 (7 节点)
    rerender(
      <ProductionLeftSidebar
        currentStepIndex={1}
        workflowProfile="fast_commentary"
      />,
    );
    expect(screen.getByText(/DAG 流水线 \(1\/7\)/)).toBeInTheDocument();
    expect(screen.getByText("短剧快节奏解说文案")).toBeInTheDocument();

    // 3. 微短剧精剪 (9 节点)
    rerender(
      <ProductionLeftSidebar
        currentStepIndex={2}
        workflowProfile="standard_drama"
      />,
    );
    expect(screen.getByText(/DAG 流水线 \(2\/9\)/)).toBeInTheDocument();
    expect(screen.getByText("统筹策划与任务派发")).toBeInTheDocument();
  });

  it("当存在运行时 dagSnapshot 时优先按实际快照节点与状态进行 1:1 动态拓扑映射", () => {
    const mockSnapshot: DagSnapshot = {
      sessionId: "dag-session-123",
      totalNodes: 3,
      completedNodes: 1,
      inCritiqueLoop: true,
      critiqueCount: 2,
      nodes: [
        {
          id: "node_1",
          name: "总控导演策划",
          role: "director",
          dependencies: [],
          status: "completed",
          durationMs: 350,
          summary: "已完成剧本分镜任务编排",
        },
        {
          id: "node_hitl",
          name: "人机协同终审",
          role: "director",
          dependencies: ["node_1"],
          status: "running",
          durationMs: 0,
          summary: "等待导演人工确认",
        },
        {
          id: "node_3",
          name: "48kHz配音合成",
          role: "voice_artist",
          dependencies: ["node_hitl"],
          status: "pending",
          durationMs: 0,
          summary: "待命",
        },
      ],
    };

    render(
      <ProductionLeftSidebar
        currentStepIndex={1}
        dagSnapshot={mockSnapshot}
        isAgentRunning={true}
      />,
    );

    expect(screen.getByText(/DAG 流水线 \(1\/3\)/)).toBeInTheDocument();
    expect(screen.getByText("反思自愈 #2")).toBeInTheDocument();
    expect(screen.getByText("总控导演策划")).toBeInTheDocument();
    expect(screen.getByText("✓ 350ms")).toBeInTheDocument();
    expect(screen.getByText("人机协同终审")).toBeInTheDocument();
    expect(screen.getByText("HITL")).toBeInTheDocument();
    expect(screen.getByText("● 运行中")).toBeInTheDocument();
  });
});
