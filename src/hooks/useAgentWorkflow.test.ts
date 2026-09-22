import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentWorkflow } from "./useAgentWorkflow";
import { agentIpc, type Project } from "@splicr/ipc";

vi.mock("@splicr/ipc", () => ({
  agentIpc: {
    start: vi.fn(),
    step: vi.fn(),
    getContext: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("startWorkflow 全自动启动并完整推进流程与流式数据回填", async () => {
    const onSceneCuts = vi.fn();
    const onScript = vi.fn();
    const onVoice = vi.fn();
    const onSubtitles = vi.fn();
    const onComplete = vi.fn();

    vi.mocked(agentIpc.start).mockResolvedValueOnce({
      session_id: "session-1",
      project: mockProject,
      status: "idle",
      current_role: "director",
      auto_mode: true,
      messages: [],
      memory: {},
    });

    // 模拟每一步无断点
    vi.mocked(agentIpc.step).mockResolvedValue(null);

    // 模拟上下文返回真实数据
    vi.mocked(agentIpc.getContext).mockResolvedValue({
      session_id: "session-1",
      project: mockProject,
      status: "thinking",
      current_role: "director",
      auto_mode: true,
      messages: [],
      memory: {
        scene_cuts_json: JSON.stringify([10.5, 25.0]),
        script_text: "这是一段真实生成的 AI 解说独白台词",
        voice_audio_path: "/tmp/voice.mp3",
        voice_duration: "32.5",
        subtitles_json: JSON.stringify([
          { text: "台词片段一", start: 0, end: 3.5 },
          { text: "台词片段二", start: 3.5, end: 7.2 },
        ]),
      },
    });

    const { result } = renderHook(() =>
      useAgentWorkflow({
        onSceneCutsGenerated: onSceneCuts,
        onScriptGenerated: onScript,
        onVoiceGenerated: onVoice,
        onSubtitlesGenerated: onSubtitles,
        onWorkflowComplete: onComplete,
      }),
    );

    await act(async () => {
      await result.current.startWorkflow(mockProject, true);
    });

    expect(agentIpc.start).toHaveBeenCalledWith(mockProject, true);
    expect(agentIpc.step).toHaveBeenCalledTimes(6);

    // 验证流式回填回调
    expect(onSceneCuts).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, time: "00:00 - 00:10" }),
      ]),
    );
    expect(onScript).toHaveBeenCalledWith("这是一段真实生成的 AI 解说独白台词");
    expect(onVoice).toHaveBeenCalledWith("/tmp/voice.mp3", 32.5);
    expect(onSubtitles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "sub-1", text: "台词片段一" }),
      ]),
    );
    expect(onComplete).toHaveBeenCalled();
    expect(result.current.isAgentRunning).toBe(false);
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
    });

    // 第 0 步正常，第 1 步触发断点
    vi.mocked(agentIpc.step)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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
    vi.mocked(agentIpc.step).mockResolvedValue(null);

    await act(async () => {
      await result.current.approveBreakpoint(true, "台词节奏优化建议");
    });

    expect(result.current.breakpoint).toBeNull();
  });
});
