/**
 * dramaxis v1.2.0 · 大语言模型厂商元数据定义 (SSOT)
 */

export interface LlmMeta {
  id: string;
  name: string;
  badge: string;
  desc: string;
  icon: string;
  defaultModel: string;
  color: string;
}

export const LLM_OPTIONS: LlmMeta[] = [
  {
    id: "qwen",
    name: "通义千问 Qwen",
    badge: "阿里旗舰",
    desc: "qwen3.8-max / qwen3.7-plus / qwen3.8-omni-flash · 阿里千问旗舰基座与原生全模态",
    icon: "🌐",
    defaultModel: "qwen3.8-max",
    color: "from-blue-500/20 to-indigo-500/10",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    badge: "强逻辑推理",
    desc: "deepseek-v4-pro / deepseek-flash · V4 代际极高逻辑推理与原生全模态",
    icon: "⚡",
    defaultModel: "deepseek-v4-pro",
    color: "from-sky-500/20 to-blue-500/10",
  },
  {
    id: "open-ai",
    name: "OpenAI",
    badge: "国际旗舰",
    desc: "gpt-5 / o3-mini / o3 / gpt-4.5-preview · 电影级第一人称独白叙事与新一代高级推理",
    icon: "🟢",
    defaultModel: "gpt-5",
    color: "from-emerald-500/20 to-teal-500/10",
  },
  {
    id: "claude",
    name: "Claude",
    badge: "文学大师",
    desc: "claude-sonnet-5-5 / claude-opus-5-5 / claude-fable-5-2 · 混合思考推理与细腻文学修辞",
    icon: "🟣",
    defaultModel: "claude-sonnet-5-5",
    color: "from-purple-500/20 to-violet-500/10",
  },
  {
    id: "gemini",
    name: "Gemini",
    badge: "百万帧感知",
    desc: "gemini-3.8-flash / gemini-3.1-pro-preview · 原生百万帧超长视听流全景解析",
    icon: "🔷",
    defaultModel: "gemini-3.8-flash",
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "kimi",
    name: "Kimi · 月之暗面",
    badge: "长剧拆条",
    desc: "kimi-k3.1-pro / kimi-k3.1-pro-highspeed · 3万亿参数原生视觉理解与百万字原著深度拆条",
    icon: "🌙",
    defaultModel: "kimi-k3.1-pro",
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "glm5",
    name: "智谱 GLM",
    badge: "清华开源",
    desc: "glm-5.3 / glm-5.3-flash / glm-5.2 · 智谱基座旗舰与多模态视频分析",
    icon: "🔮",
    defaultModel: "glm-5.3",
    color: "from-indigo-500/20 to-purple-500/10",
  },
  {
    id: "doubao",
    name: "豆包 Doubao",
    badge: "字节短剧",
    desc: "doubao-seed-2-1-pro-260915 / doubao-seed-evolving · 字节短剧深度思考与视听多模态",
    icon: "📦",
    defaultModel: "doubao-seed-2-1-pro-260915",
    color: "from-rose-500/20 to-pink-500/10",
  },
  {
    id: "hunyuan",
    name: "混元 Hunyuan",
    badge: "腾讯旗舰",
    desc: "hy4 / hy4-preview / hy3 / hunyuan-a13b · 腾讯混元主力旗舰与原生视觉理解",
    icon: "🐧",
    defaultModel: "hy4",
    color: "from-blue-600/20 to-cyan-500/10",
  },
  {
    id: "local",
    name: "本地 Ollama",
    badge: "私有离线",
    desc: "deepseek-r1:14b / qwq:32b / qwen3:14b (本地 Ollama / LMStudio)",
    icon: "💻",
    defaultModel: "deepseek-r1:14b",
    color: "from-zinc-500/20 to-zinc-600/10",
  },
  {
    id: "custom",
    name: "自定义大模型",
    badge: "中转/兼容",
    desc: "兼容 OpenAI 规范 / SiliconFlow / OneAPI / 任意中转",
    icon: "⚙️",
    defaultModel: "deepseek-chat",
    color: "from-amber-500/20 to-yellow-500/10",
  },
];
