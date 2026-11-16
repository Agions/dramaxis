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

export const MOSSLAND_PRESET_VOICES = [
  { id: "moss-narrator-male", label: "沉浸电影男声" },
  { id: "moss-suspense-01", label: "悬疑解说" },
  { id: "moss-narrator-female", label: "情感叙事女声" },
] as const;
