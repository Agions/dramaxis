import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CloneReferenceCard } from "./CloneReferenceCard";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CloneReferenceCard", () => {
  const onRefAudioPathChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始未选择参考音频时展示导入引导文案", () => {
    render(
      <CloneReferenceCard
        refAudioPath={null}
        onRefAudioPathChange={onRefAudioPathChange}
      />,
    );
    expect(screen.getByText("🧬 5 秒参考音频零样本克隆")).toBeInTheDocument();
    expect(
      screen.getByText("导入一段 5~10 秒的主角无杂音干声音频"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("选择参考音频文件 (.wav / .mp3)"),
    ).toBeInTheDocument();
  });

  it("点击选择音频按钮调用 dialog 并在成功后派发变更", async () => {
    vi.mocked(open).mockResolvedValueOnce("/path/to/actor_voice.wav");

    render(
      <CloneReferenceCard
        refAudioPath={null}
        onRefAudioPathChange={onRefAudioPathChange}
      />,
    );

    fireEvent.click(screen.getByText("选择参考音频文件 (.wav / .mp3)"));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({
        multiple: false,
        filters: [
          {
            name: "参考音频 (Audio)",
            extensions: ["wav", "mp3", "flac", "m4a"],
          },
        ],
      });
    });

    expect(onRefAudioPathChange).toHaveBeenCalledWith(
      "/path/to/actor_voice.wav",
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已载入参考音频: actor_voice.wav",
    );
  });
});
