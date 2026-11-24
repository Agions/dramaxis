import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AsrSection } from "./asr";
import { settingsIpc, type ConfigSnapshot } from "@dramaxis/ipc";

vi.mock("@dramaxis/ipc", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@dramaxis/ipc");
  return {
    ...actual,
    settingsIpc: {
      ...((actual.settingsIpc as object) || {}),
      testAsr: vi.fn().mockResolvedValue({
        success: true,
        latencyMs: 42,
        message: "Whisper CLI 探测成功 (whisper-cli)，本地模型文件就绪",
      }),
    },
  };
});

describe("AsrSection", () => {
  const defaultMockConfig: ConfigSnapshot = {
    theme: "dark",
    language: "zh-CN",
    llm_provider: "deepseek",
    auto_update: false,
    first_run: false,
    llm_api_key: "sk-test",
    llm_base_url: "https://api.deepseek.com/v1",
    llm_model: "deepseek-v4-pro",
    tts_provider: "edge",
    tts_voice: "zh-CN-YunxiNeural",
    tts_model: null,
    tts_base_url: null,
    tts_api_key: null,
    tts_ref_audio_path: null,
    tts_prompt_text: null,
    agent_model_matrix: null,
    asr_provider: "auto",
    asr_whisper_cli_path: "/usr/local/bin/whisper-cli",
    asr_whisper_model_path: "/models/base.bin",
    asr_api_base_url: "https://api.openai.com/v1",
    asr_api_model: "whisper-1",
    asr_api_key: null,
    asr_language: "zh",
  };

  it("正确渲染 ASR 渠道卡片与配置面板", () => {
    const setForm = vi.fn();
    render(<AsrSection form={defaultMockConfig} setForm={setForm} />);

    expect(screen.getByText("智能三级降级 (推荐)")).toBeInTheDocument();
    expect(screen.getByText("本地 whisper-cli (whisper.cpp)")).toBeInTheDocument();
    expect(screen.getByText("OpenAI / SenseVoice 兼容端点")).toBeInTheDocument();
    expect(screen.getByText("仅读取伴随 .srt 字幕")).toBeInTheDocument();
    expect(screen.getByText("ASR 语音转写与台词提取参数")).toBeInTheDocument();
  });

  it("点击切换 ASR 模式能正确触发 setForm", () => {
    let currentConfig = { ...defaultMockConfig };
    const setForm = vi.fn((updater) => {
      if (typeof updater === "function") {
        currentConfig = updater(currentConfig);
      }
    });

    render(<AsrSection form={currentConfig} setForm={setForm} />);

    const cliCard = screen.getByText("本地 whisper-cli (whisper.cpp)");
    fireEvent.click(cliCard);

    expect(setForm).toHaveBeenCalled();
    expect(currentConfig.asr_provider).toBe("whisper_cli");
  });

  it("点击连通性/模型探测按钮成功调用 settingsIpc.testAsr 并展示结果", async () => {
    const setForm = vi.fn();
    render(<AsrSection form={defaultMockConfig} setForm={setForm} />);

    const testBtn = screen.getByText("⚡ 连通性 / 模型探测");
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(settingsIpc.testAsr).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "auto",
          whisperCliPath: "/usr/local/bin/whisper-cli",
          whisperModelPath: "/models/base.bin",
        })
      );
      expect(
        screen.getByText("Whisper CLI 探测成功 (whisper-cli)，本地模型文件就绪")
      ).toBeInTheDocument();
    });
  });
});
