import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TtsVoicesSection } from "./TtsVoicesSection";
import type { ConfigSnapshot } from "@dramaxis/ipc";

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

describe("TtsVoicesSection", () => {
  const defaultMockConfig: ConfigSnapshot = {
    llm_provider: "deepseek",
    llm_api_key: "sk-test",
    llm_base_url: "https://api.deepseek.com/v1",
    llm_model: "deepseek-chat",
    agent_director_model: null,
    agent_screenwriter_model: null,
    agent_visual_critic_model: null,
    agent_voice_artist_model: null,
    agent_sound_engineer_model: null,
    agent_quality_reviewer_model: null,
    tts_provider: "edge",
    tts_voice: "zh-CN-YunxiNeural",
    tts_model: null,
    tts_base_url: null,
    tts_api_key: null,
    tts_ref_audio_path: null,
    tts_prompt_text: null,
    export_preset: "1080p_douyin",
    hardware_acceleration: "none",
    auto_detect_scenes: true,
    language: "zh-CN",
    dark_mode: true,
  };

  it("正确渲染 TTS 厂商列表及当前选中参数", () => {
    const setForm = vi.fn();
    render(<TtsVoicesSection form={defaultMockConfig} setForm={setForm} />);

    expect(screen.getByText("Edge TTS")).toBeInTheDocument();
    expect(screen.getByText("Mossland 摩斯配音")).toBeInTheDocument();
    expect(screen.getByText("OpenAI TTS")).toBeInTheDocument();
    expect(screen.getByText("MiniMax / MiMo")).toBeInTheDocument();
    expect(screen.getByText("GPT-SoVITS")).toBeInTheDocument();
    expect(screen.getByText("Edge TTS 配音引擎参数")).toBeInTheDocument();
  });

  it("点击切换厂商卡片时能触发 setForm 更新供应商与默认声线", () => {
    let currentConfig = { ...defaultMockConfig };
    const setForm = vi.fn((updater) => {
      if (typeof updater === "function") {
        currentConfig = updater(currentConfig);
      }
    });

    render(<TtsVoicesSection form={currentConfig} setForm={setForm} />);

    // 点击 Mossland 摩斯配音卡片
    const mosslandCard = screen.getByText("Mossland 摩斯配音");
    fireEvent.click(mosslandCard);

    expect(setForm).toHaveBeenCalled();
    expect(currentConfig.tts_provider).toBe("mossland");
    expect(currentConfig.tts_voice).toBe("moss-narrator-male");
    expect(currentConfig.tts_model).toBe("moss-tts-v1");
    expect(currentConfig.tts_base_url).toBe("https://api.mossland.studio/v1");
  });
});
