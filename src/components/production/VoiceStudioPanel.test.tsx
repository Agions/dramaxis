import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoiceStudioPanel } from "./VoiceStudioPanel";
import { voiceIpc } from "@dramaxis/ipc";
import { toast } from "sonner";

vi.mock("@dramaxis/ipc", () => ({
  voiceIpc: {
    preview: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn().mockReturnValue("toast-id"),
  },
}));

describe("VoiceStudioPanel", () => {
  const onVoiceEngineChange = vi.fn();
  const onAudioGenerated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正确渲染 TTS 引擎选项、音色预设与生成按钮", () => {
    render(
      <VoiceStudioPanel
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText="这是一个悬疑短剧的开头..."
        onAudioGenerated={onAudioGenerated}
      />,
    );

    expect(screen.getByText("TTS 引擎")).toBeInTheDocument();
    expect(screen.getByText("Edge-TTS")).toBeInTheDocument();
    expect(screen.getByText("Mossland 摩斯配音")).toBeInTheDocument();
    expect(screen.getByText("OpenAI TTS")).toBeInTheDocument();
    expect(screen.getByText("MiniMax / MiMo")).toBeInTheDocument();
    expect(screen.getByText("说话人音色预设")).toBeInTheDocument();
    expect(screen.getByText("解说语速微调")).toBeInTheDocument();
    expect(screen.getByText("🎙️ 生成 48kHz 高清解说配音")).toBeInTheDocument();
  });

  it("点击切换引擎时派发 onVoiceEngineChange 回调并重置为合法音色", () => {
    const { rerender } = render(
      <VoiceStudioPanel
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText="文案"
        onAudioGenerated={onAudioGenerated}
      />,
    );

    // 切换到 OpenAI TTS
    const openaiRadio = screen.getByDisplayValue("open-ai");
    fireEvent.click(openaiRadio);
    expect(onVoiceEngineChange).toHaveBeenCalledWith("open-ai");

    // rerender 为 open-ai
    rerender(
      <VoiceStudioPanel
        voiceEngine="open-ai"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText="文案"
        onAudioGenerated={onAudioGenerated}
      />,
    );
    expect(screen.getByText(/Alloy · 自然均衡影视男声/)).toBeInTheDocument();
  });

  it("支持选择不同语速微调预设", () => {
    render(
      <VoiceStudioPanel
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText="文案"
        onAudioGenerated={onAudioGenerated}
      />,
    );

    expect(screen.getByText(/原速 1.0x/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("1.15x 紧凑"));
    expect(screen.getByText(/\+15%/)).toBeInTheDocument();
    expect(screen.getByText(/快节奏推荐/)).toBeInTheDocument();
  });

  it("文案为空时点击生成配音提示警告", async () => {
    render(
      <VoiceStudioPanel
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText=""
        onAudioGenerated={onAudioGenerated}
      />,
    );

    fireEvent.click(screen.getByText("🎙️ 生成 48kHz 高清解说配音"));
    expect(toast.warning).toHaveBeenCalledWith("请先生成或输入解说剧本文案");
    expect(voiceIpc.preview).not.toHaveBeenCalled();
  });

  it("文案有效时点击生成配音成功调用 IPC 并触发 onAudioGenerated 回调", async () => {
    vi.mocked(voiceIpc.preview).mockResolvedValueOnce({
      filePath: "/output/voice.mp3",
      bytesWritten: 10240,
    } as any);

    render(
      <VoiceStudioPanel
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
        scriptText="男主角站在天台上，冷冷地看着脚下的繁华城市。"
        onAudioGenerated={onAudioGenerated}
      />,
    );

    fireEvent.click(screen.getByText("🎙️ 生成 48kHz 高清解说配音"));

    await waitFor(() => {
      expect(voiceIpc.preview).toHaveBeenCalledWith({
        provider: "edge",
        voice: "zh-CN-YunxiNeural",
        ratePercent: 0,
        text: "男主角站在天台上，冷冷地看着脚下的繁华城市。",
        apiKey: null,
        baseUrl: null,
        model: null,
        refAudioPath: null,
        promptText: null,
      });
    });

    expect(onAudioGenerated).toHaveBeenCalledWith("/output/voice.mp3");
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("配音生成完成"),
      expect.anything(),
    );
  });
});
