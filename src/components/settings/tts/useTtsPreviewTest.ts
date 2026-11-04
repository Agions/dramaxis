import { useState, useCallback } from "react";
import { voiceIpc } from "@dramaxis/ipc";
import { toast } from "sonner";
import type { TtsMeta } from "./ttsOptions";

export interface TtsPreviewParams {
  provider: string;
  voice: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  refAudioPath?: string | null;
  promptText?: string | null;
}

export function useTtsPreviewTest() {
  const [isPlaying, setIsPlaying] = useState(false);

  const testPreview = useCallback(async (currentTts: TtsMeta, params: TtsPreviewParams) => {
    setIsPlaying(true);
    try {
      await toast.promise(
        voiceIpc.preview({
          provider: params.provider || "edge",
          voice: params.voice || currentTts.defaultVoice || null,
          ratePercent: 0,
          text: "叙影，致力于打造高水准多智能体影视解说自动化工坊。",
          apiKey: params.apiKey || null,
          baseUrl: params.baseUrl || currentTts.defaultBaseUrl || null,
          model: params.model || currentTts.defaultModel || null,
          refAudioPath: params.refAudioPath || null,
          promptText: params.promptText || null,
        }),
        {
          loading: `正在请求 ${currentTts.label} 合成试听片段...`,
          success: (res) => `✓ 试听音频生成成功 (${res.bytesWritten} 字节)`,
          error: (err) => `TTS 合成失败: ${err?.message ?? "请检查配置或网络"}`,
        },
      );
    } finally {
      setIsPlaying(false);
    }
  }, []);

  return {
    isPlaying,
    testPreview,
  };
}
