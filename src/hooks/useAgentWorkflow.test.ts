import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentWorkflow } from "./useAgentWorkflow";
import { agentIpc, type Project, type Blackboard } from "@dramaxis/ipc";

vi.mock("@dramaxis/ipc", () => ({
  agentIpc: {
    start: vi.fn(),
    step: vi.fn(),
    runDag: vi.fn(),
    resumeBreakpoint: vi.fn(),
    getDagSnapshot: vi.fn(),
    getContext: vi.fn(),
    getBlackboard: vi.fn(),
    rollbackScript: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useAgentWorkflow", () => {
  const mockProject: Project = {
    id: "proj-agent-test",
    name: "短剧项目",
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
    media_files: [],
    timeline: { tracks: [] },
    scripts: [],
    exports: [],
  };

  const emptyBlackboard: Blackboard = {
    sessionId: "session-1",
    createdAt: 1700000000,
    scriptVersions: [],
    activeScriptIndex: 0,
    visualBrief: null,
    audioBrief: null,
    voiceArtifact: null,
    timelineArtifact: null,
    qualityReport: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentIpc.getBlackboard).mockResolvedValue(emptyBlackboard);
  });

  it("初始状态正确且支持 resetWorkflow 重置", () => {
    const { result } = renderHook(() => useAgentWorkflow());

    expect(result.current.isAgentRunning).toBe(false);
    expect(result.current.currentStepIndex).toBe(-1);
    expect(result.current.agentAutoMode).toBe(true);
    expect(result.current.agentMessages).toEqual([]);
    expect(result.current.breakpoint).toBeNull();

    act(() => {
      result.current.resetWorkflow();
    });

    expect(result.current.currentStepIndex).toBe(-1);
    expect(result.current.isAgentRunning).toBe(false);
  });

  it("startWorkflow 全自动启动并通过 Blackboard 完整回填视听产物", async () => {
    const onSceneCuts = vi.fn();
    const onScript = vi.fn();
    const onVoice = vi.fn();
    const onQuality = vi.fn();

    vi.mocked(agentIpc.start).mockResolvedValueOnce({
      session_id: "session-1",
      project: mockProject,
      status: "idle",
      current_role: "director",
      auto_mode: true,
      messages: [],
      memory: {},
      blackboard: emptyBlackboard,
    });

    vi.mocked(agentIpc.runDag).mockResolvedValueOnce(null);

    const mockBlackboard: Blackboard = {
      sessionId: "session-1",
      createdAt: 1700000000,
      scriptVersions: [
        {
          version: 1,
          authorAgent: "screenwriter",
          promptUsed: "爆款解说",
          text: "这是一段真实生成的 AI 解说独白台词",
          hookType: "悬念逆转",
          hookText: "开头留白",
          estimatedRetention: 92.0,
          critiqueFeedback: null,
          createdAt: Date.now(),
        },
      ],
      activeScriptIndex: 0,
      visualBrief: {
        totalDurationSec: 60.0,
        sceneCutsSec: [10.5, 25.0],
        keyframePaths: ["/tmp/kf1.jpg"],
        visualSummary: "视觉分析完成",
      },
      audioBrief: {
        hasOriginalSpeech: true,
        speechIntervals: [{ start: 0.0, end: 15.0 }],
        bgmIntensityPeaks: [3.0],
        dialogueSummary: "原声对白",
      },
      voiceArtifact: {
        audioPath: "/tmp/voice.mp3",
        durationSeconds: 32.5,
        sampleRate: 44100,
        voiceId: "zh-CN-Yunxi",
        provider: "edge-tts",
      },
      timelineArtifact: null,
      qualityReport: {
        hookScore: 92.0,
        syncToleranceMs: 42.5,
        pacingScore: 94.0,
        compliancePassed: true,
        overallScore: 92.5,
        suggestions: ["留白适度"],
      },
    };

    vi.mocked(agentIpc.getBlackboard).mockResolvedValue(mockBlackboard);

    const { result } = renderHook(() =>
      useAgentWorkflow({
        onSceneCutsGenerated: onSceneCuts,
        onScriptGenerated: onScript,
        onVoiceGenerated: onVoice,
        onQualityEvaluated: onQuality,
      }),
    );

    await act(async () => {
      await result.current.startWorkflow(mockProject, true);
    });

    expect(agentIpc.start).toHaveBeenCalledWith(mockProject, true);
    expect(agentIpc.runDag).toHaveBeenCalledTimes(1);

    // 验证黑板总线产物同步与回填回调
    expect(onSceneCuts).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, time: "00:00 - 00:10" }),
      ]),
    );
    expect(onScript).toHaveBeenCalledWith("这是一段真实生成的 AI 解说独白台词");
    expect(onVoice).toHaveBeenCalledWith("/tmp/voice.mp3", 32.5);
    expect(onQuality).toHaveBeenCalledWith(
      expect.objectContaining({ overallScore: 92.5, hookScore: 92.0 }),
    );
    expect(result.current.qualityReport).toEqual(
      expect.objectContaining({ overallScore: 92.5 }),
    );
    expect(result.current.blackboard).toEqual(mockBlackboard);
  });

  it("当节点触发断点请求时暂停并支持 approveBreakpoint 批准继续", async () => {
    vi.mocked(agentIpc.start).mockResolvedValueOnce({
      session_id: "session-1",
      project: mockProject,
      status: "idle",
      current_role: "director",
      auto_mode: false,
      messages: [],
      memory: {},
      blackboard: emptyBlackboard,
    });

    vi.mocked(agentIpc.runDag).mockResolvedValueOnce({
      agent: "screenwriter",
      step_title: "✍️ 金牌编剧独白审核",
      content: "待审阅剧本文案",
      options: ["通过", "驳回"],
    });

    const { result } = renderHook(() => useAgentWorkflow());

    await act(async () => {
      await result.current.startWorkflow(mockProject, false);
    });

    // 验证断点已挂起
    expect(result.current.breakpoint).toEqual({
      agent: "screenwriter",
      step_title: "✍️ 金牌编剧独白审核",
      content: "待审阅剧本文案",
      options: ["通过", "驳回"],
    });
    expect(result.current.isAgentRunning).toBe(false);

    // 批准断点并继续执行
    vi.mocked(agentIpc.resumeBreakpoint).mockResolvedValueOnce(null);

    await act(async () => {
      await result.current.approveBreakpoint(true, "台词节奏优化建议");
    });

    expect(agentIpc.resumeBreakpoint).toHaveBeenCalledWith(
      "批准定稿并进入配音",
      "台词节奏优化建议",
    );
    expect(result.current.breakpoint).toBeNull();
  });

  it("runDagWorkflow 启动并支持 resumeDagBreakpoint 恢复断点与剧本版本回退", async () => {
    vi.mocked(agentIpc.start).mockResolvedValueOnce({
      session_id: "sess-dag-001",
      project: mockProject,
      status: "awaiting_approval",
      current_role: "director",
      auto_mode: false,
      messages: [],
      memory: {},
      blackboard: emptyBlackboard,
    });

    vi.mocked(agentIpc.runDag).mockResolvedValueOnce({
      agent: "director",
      step_title: "🤝 人机协同 · 剧本精修与终版确认 (HITL)",
      content: "第一人称解说初稿",
      options: ["批准定稿并进入配音", "重新微调剧本"],
    });

    const { result } = renderHook(() => useAgentWorkflow());

    await act(async () => {
      await result.current.runDagWorkflow(mockProject, false);
    });

    expect(agentIpc.start).toHaveBeenCalledWith(mockProject, false);
    expect(agentIpc.runDag).toHaveBeenCalledTimes(1);
    expect(result.current.breakpoint?.agent).toBe("director");

    vi.mocked(agentIpc.resumeBreakpoint).mockResolvedValueOnce(null);

    await act(async () => {
      await result.current.resumeDagBreakpoint("批准定稿并进入配音");
    });

    expect(agentIpc.resumeBreakpoint).toHaveBeenCalledWith(
      "批准定稿并进入配音",
      null,
    );
    expect(result.current.breakpoint).toBeNull();

    // 测试剧本版本回退
    vi.mocked(agentIpc.rollbackScript).mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.rollbackScript(1);
    });
    expect(agentIpc.rollbackScript).toHaveBeenCalledWith(1);
  });
});
