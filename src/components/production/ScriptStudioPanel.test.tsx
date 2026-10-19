import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScriptStudioPanel } from "./ScriptStudioPanel";
import { scriptIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  scriptIpc: {
    generate: vi.fn(),
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

describe("ScriptStudioPanel", () => {
  const defaultProps = {
    llmProvider: "qwen",
    onLlmProviderChange: vi.fn(),
    scriptStyle: "immersive" as const,
    onScriptStyleChange: vi.fn(),
    userPrompt: "悬疑破案短剧，凶手是主角的双胞胎弟弟",
    onUserPromptChange: vi.fn(),
    scriptText: "这是一个扣人心弦的故事...",
    onScriptTextChange: vi.fn(),
    isGeneratingScript: false,
    onGenerateScript: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders script studio controls properly", () => {
    render(<ScriptStudioPanel {...defaultProps} />);

    expect(screen.getByText("大模型选择")).toBeInTheDocument();
    expect(screen.getByText("解说风格")).toBeInTheDocument();
    expect(screen.getByText("提示词 / 剧情脉络")).toBeInTheDocument();
    expect(screen.getByText("🎯 黄金 3 秒爆款 Hook 引擎")).toBeInTheDocument();
    expect(screen.getByText("解说文案编辑")).toBeInTheDocument();
    expect(screen.getByText("⚡ 重新生成 AI 剧本")).toBeInTheDocument();
  });

  it("triggers generateHooks when clicking the hook button", async () => {
    const mockHooks = [
      {
        formula: "result_first",
        formulaName: "结果前置型 (高潮前置)",
        hookText: "关于这个案子：他被至亲推入深渊，这一切竟是二十年前的致命圈套！",
        estimatedRetentionScore: 94.5,
        strategyReason: "结果高潮前置，极度吸引悬疑偏好受众。",
      },
      {
        formula: "counter_intuitive",
        formulaName: "反常识型 (认知颠覆)",
        hookText: "千万别轻易测试人性！这部电影把所有人最丑陋的秘密撕得粉碎。",
        estimatedRetentionScore: 91.0,
        strategyReason: "颠覆常规道德认知，激发停留时长。",
      },
    ];

    vi.mocked(scriptIpc.generateHooks).mockResolvedValueOnce(mockHooks as any);

    render(<ScriptStudioPanel {...defaultProps} />);

    const generateHookBtn = screen.getByText("⚡ 一键推导 4 大公式");
    fireEvent.click(generateHookBtn);

    await waitFor(() => {
      expect(scriptIpc.generateHooks).toHaveBeenCalledWith(
        "悬疑破案短剧，凶手是主角的双胞胎弟弟",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("结果前置型 (高潮前置)")).toBeInTheDocument();
      expect(screen.getByText("94.5% 预估留存")).toBeInTheDocument();
      expect(screen.getByText("反常识型 (认知颠覆)")).toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith(
      "成功生成 4 大公式爆款 Hook (0~3s 黄金留存)",
    );
  });

  it("applies selected hook to script text when clicking adopt button", async () => {
    const mockHooks = [
      {
        formula: "result_first",
        formulaName: "结果前置型 (高潮前置)",
        hookText: "关于这个案子：他被至亲推入深渊，这一切竟是二十年前的致命圈套！",
        estimatedRetentionScore: 94.5,
        strategyReason: "结果高潮前置，极度吸引悬疑偏好受众。",
      },
    ];

    vi.mocked(scriptIpc.generateHooks).mockResolvedValueOnce(mockHooks as any);

    render(<ScriptStudioPanel {...defaultProps} />);

    const generateHookBtn = screen.getByText("⚡ 一键推导 4 大公式");
    fireEvent.click(generateHookBtn);

    await waitFor(() => {
      expect(screen.getByText("采纳开场")).toBeInTheDocument();
    });

    const adoptBtn = screen.getByText("采纳开场");
    fireEvent.click(adoptBtn);

    expect(defaultProps.onScriptTextChange).toHaveBeenCalledWith(
      "关于这个案子：他被至亲推入深渊，这一切竟是二十年前的致命圈套！\n\n这是一个扣人心弦的故事...",
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已采纳【结果前置型 (高潮前置)】为黄金 3 秒开场！",
    );
  });

  it("copies script text to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ScriptStudioPanel {...defaultProps} />);

    const copyBtn = screen.getByText("📋 复制");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("这是一个扣人心弦的故事...");
    expect(toast.success).toHaveBeenCalledWith("文案已复制到剪贴板");
  });
});
