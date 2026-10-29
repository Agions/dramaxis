import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReferenceDeconstructCard } from "./ReferenceDeconstructCard";
import { scriptIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  scriptIpc: {
    deconstructReference: vi.fn(),
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

describe("ReferenceDeconstructCard", () => {
  const onUserPromptChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("点击展开解构器，输入参考文案并解构成功展示热词与画像", async () => {
    const mockProfile = {
      titleOrGenre: "爽文逆袭剧",
      avgSentenceLength: 14.5,
      estimatedWpm: 260,
      viralKeywords: ["反转", "打脸", "绝境"],
      formulaSummary: "开篇极致压抑随后强力反击",
      fewShotPrompt: "请采用简短有力的短句和高密度网感词",
    };
    vi.mocked(scriptIpc.deconstructReference).mockResolvedValueOnce(
      mockProfile as any,
    );

    render(
      <ReferenceDeconstructCard
        userPrompt="普通男主重生"
        onUserPromptChange={onUserPromptChange}
      />,
    );

    // 展开对标解构卡片
    fireEvent.click(screen.getByText("🔍 对标爆款 Few-Shot 解构 ▼"));
    expect(screen.getByText(/爆款参考文案解构/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/在此粘贴同赛道爆款解说词片段/);
    fireEvent.change(textarea, { target: { value: "爆款参考文案样本..." } });

    fireEvent.click(screen.getByText("⚡ 一键解构画像"));

    await waitFor(() => {
      expect(screen.getByText("画像: 爽文逆袭剧")).toBeInTheDocument();
      expect(screen.getByText("打脸")).toBeInTheDocument();
      expect(screen.getByText("+ 注入提示词")).toBeInTheDocument();
    });

    // 点击注入提示词
    fireEvent.click(screen.getByText("+ 注入提示词"));
    expect(onUserPromptChange).toHaveBeenCalledWith(
      expect.stringContaining("【对标爆款风格画像】"),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已将对标爆款画像注入提示词输入框！",
    );
  });
});
