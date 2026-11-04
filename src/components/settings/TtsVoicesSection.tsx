import type { ConfigSnapshot } from "@dramaxis/ipc";
import { TTS_OPTIONS, type TtsMeta } from "./tts/ttsOptions";
import { useTtsPreviewTest } from "./tts/useTtsPreviewTest";
import { TtsProviderGrid } from "./tts/TtsProviderGrid";
import { TtsEngineConfigCard } from "./tts/TtsEngineConfigCard";

// Re-export types & constants for backward compatibility
export type { TtsMeta };
export { TTS_OPTIONS };

interface TtsVoicesSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export function TtsVoicesSection({ form, setForm }: TtsVoicesSectionProps) {
  const currentTts =
    TTS_OPTIONS.find((o) => o.id === form.tts_provider) ?? TTS_OPTIONS[0]!;

  const { isPlaying, testPreview } = useTtsPreviewTest();

  const handleSelectProvider = (item: TtsMeta) => {
    setForm((prev) => ({
      ...prev,
      tts_provider: item.id,
      tts_base_url: item.defaultBaseUrl || prev.tts_base_url,
      tts_voice: item.defaultVoice || prev.tts_voice,
      tts_model: item.defaultModel || prev.tts_model,
    }));
  };

  const handlePreview = () => {
    testPreview(currentTts, {
      provider: form.tts_provider ?? "edge",
      voice: form.tts_voice ?? currentTts.defaultVoice ?? null,
      apiKey: form.tts_api_key ?? null,
      baseUrl: form.tts_base_url || currentTts.defaultBaseUrl || null,
      model: form.tts_model || currentTts.defaultModel || null,
      refAudioPath: form.tts_ref_audio_path ?? null,
      promptText: form.tts_prompt_text ?? null,
    });
  };

  return (
    <div className="space-y-6">
      {/* TTS 厂商选择阵列 */}
      <TtsProviderGrid
        currentProvider={form.tts_provider}
        onSelect={handleSelectProvider}
      />

      {/* 参数配置卡片 */}
      <TtsEngineConfigCard
        currentTts={currentTts}
        form={form}
        setForm={setForm}
        onPreview={handlePreview}
        isPlayingPreview={isPlaying}
      />
    </div>
  );
}
