import { useState } from "react";
import { voiceIpc, type ConfigSnapshot } from "@dramaxis/ipc";
import { Badge, Card } from "@dramaxis/ui";
import { toast } from "sonner";

export interface TtsMeta {
  id: "edge" | "mimo" | "open-ai" | "gpt-sovits" | "mossland" | "custom";
  label: string;
  tag: string;
  hint: string;
  icon: string;
  needApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel?: string;
  defaultVoice?: string;
}

export const TTS_OPTIONS: TtsMeta[] = [
  {
    id: "edge",
    label: "Edge TTS",
    tag: "免费免Key",
    hint: "微软官方 · 48kHz 高清采样 · 50+ 电影声优",
    icon: "🎙️",
    needApiKey: false,
    defaultVoice: "zh-CN-YunxiNeural",
  },
  {
    id: "mossland",
    label: "Mossland 摩斯配音",
    tag: "影视情绪推荐",
    hint: "mossland.studio · 影视解说专属电影情绪声线 (OpenAI TTS 协议)",
    icon: "🎭",
    needApiKey: true,
    defaultBaseUrl: "https://api.mossland.studio/v1",
    defaultModel: "moss-tts-v1",
    defaultVoice: "moss-narrator-male",
  },
  {
    id: "open-ai",
    label: "OpenAI TTS",
    tag: "影视级原声",
    hint: "tts-1-hd / alloy / onyx 电影级情绪声线 (需填写 OpenAI API Key)",
    icon: "💎",
    needApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "tts-1-hd",
    defaultVoice: "alloy",
  },
  {
    id: "mimo",
    label: "MiniMax / MiMo",
    tag: "商业旗舰",
    hint: "speech-02-hd · 情感细腻自然人声 (需填写 API Key)",
    icon: "📱",
    needApiKey: true,
    defaultBaseUrl: "https://api.minimax.chat/v1",
    defaultModel: "speech-02-hd",
    defaultVoice: "female-shaonv",
  },
  {
    id: "gpt-sovits",
    label: "GPT-SoVITS",
    tag: "零样本克隆",
    hint: "本地部署 127.0.0.1:9880 · 5 秒参考音频克隆音色",
    icon: "🧬",
    needApiKey: false,
    defaultBaseUrl: "http://127.0.0.1:9880",
    defaultVoice: "default",
  },
  {
    id: "custom",
    label: "自定义 OpenAI TTS",
    tag: "自建/中转",
    hint: "兼容 /v1/audio/speech 的任意 TTS 平台、聚合反代或第三方声音 API",
    icon: "⚙️",
    needApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "tts-1",
    defaultVoice: "alloy",
  },
];

interface TtsVoicesSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export function TtsVoicesSection({ form, setForm }: TtsVoicesSectionProps) {
  const [showKey, setShowKey] = useState(false);
  const currentTts =
    TTS_OPTIONS.find((o) => o.id === form.tts_provider) ?? TTS_OPTIONS[0]!;

  const handleTestTts = () => {
    toast.promise(
      voiceIpc.preview({
        provider: form.tts_provider ?? "edge",
        voice: form.tts_voice ?? currentTts.defaultVoice ?? null,
        ratePercent: 0,
        text: "叙影，致力于打造高水准多智能体影视解说自动化工坊。",
        apiKey: form.tts_api_key ?? null,
        baseUrl: form.tts_base_url || currentTts.defaultBaseUrl || null,
        model: form.tts_model || currentTts.defaultModel || null,
        refAudioPath: form.tts_ref_audio_path ?? null,
        promptText: form.tts_prompt_text ?? null,
      }),
      {
        loading: `正在请求 ${currentTts.label} 合成试听片段...`,
        success: (res) => `✓ 试听音频生成成功 (${res.bytesWritten} 字节)`,
        error: (err) => `TTS 合成失败: ${err?.message ?? "请检查配置或网络"}`,
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* TTS 厂商选择 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TTS_OPTIONS.map((item) => {
          const selected = form.tts_provider === item.id;
          return (
            <Card
              key={item.id}
              interactive
              glow={selected}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  tts_provider: item.id,
                  tts_base_url: item.defaultBaseUrl || prev.tts_base_url,
                  tts_voice: item.defaultVoice || prev.tts_voice,
                  tts_model: item.defaultModel || prev.tts_model,
                }))
              }
              className={`p-4 text-left ${selected ? "border-gold bg-gold-muted" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <Badge variant={selected ? "gold" : "zinc"}>{item.tag}</Badge>
              </div>
              <div className="mt-3 text-sm font-bold text-text-primary">
                {item.label}
              </div>
              <div className="text-[11px] text-text-secondary mt-1 leading-snug">
                {item.hint}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 参数配置 */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <div className="text-sm font-bold text-text-primary">
              {currentTts.label} 配音引擎参数
            </div>
            <div className="text-[11px] text-text-secondary">
              {currentTts.hint}
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestTts}
            className="rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-text-primary transition hover:border-gold active:scale-95"
          >
            ▶ 试听合成
          </button>
        </div>

        {currentTts.needApiKey && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              API Key 凭据
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={form.tts_api_key || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tts_api_key: e.target.value || null,
                  }))
                }
                placeholder={`请输入 ${currentTts.label} API Key`}
                className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary hover:text-text-primary"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
        )}

        {/* 默认声线与模型选择 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              默认角色声线 (Voice / Speaker)
            </label>
            <input
              type="text"
              value={form.tts_voice || currentTts.defaultVoice || "zh-CN-YunxiNeural"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tts_voice: e.target.value || null,
                }))
              }
              placeholder={currentTts.defaultVoice || "如 moss-narrator-male / zh-CN-YunxiNeural"}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
            />
            {form.tts_provider === "mossland" && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-text-muted">推荐解说声线:</span>
                {[
                  { id: "moss-narrator-male", label: "沉浸电影男声" },
                  { id: "moss-suspense-01", label: "悬疑解说" },
                  { id: "moss-narrator-female", label: "情感叙事女声" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, tts_voice: v.id }))}
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-muted hover:bg-gold/20 hover:text-gold text-text-secondary border border-border transition-colors"
                  >
                    {v.label} ({v.id})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              TTS 模型名称 (Model)
            </label>
            <input
              type="text"
              value={form.tts_model || currentTts.defaultModel || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tts_model: e.target.value || null,
                }))
              }
              placeholder={currentTts.defaultModel || "如 moss-tts-v1 / tts-1 / tts-1-hd"}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        {/* 服务 Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary">
            服务 Base URL
          </label>
          <input
            type="text"
            value={form.tts_base_url || currentTts.defaultBaseUrl || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tts_base_url: e.target.value || null,
              }))
            }
            placeholder={currentTts.defaultBaseUrl || "官方默认地址"}
            className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
          />
        </div>
      </Card>
    </div>
  );
}
