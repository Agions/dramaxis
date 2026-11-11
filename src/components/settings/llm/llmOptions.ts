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
    desc: "qwen-plus · 原生多模态与爆点 Hook 解析",
    icon: "🌐",
    defaultModel: "qwen-plus",
    color: "from-blue-500/20 to-indigo-500/10",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    badge: "强逻辑推理",
    desc: "deepseek-chat · 复杂剧情冲突与反转逻辑链",
    icon: "⚡",
    defaultModel: "deepseek-chat",
    color: "from-sky-500/20 to-blue-500/10",
  },
  {
    id: "open-ai",
    name: "OpenAI",
    badge: "国际旗舰",
    desc: "gpt-4o · 电影级第一人称独白叙事",
    icon: "🟢",
    defaultModel: "gpt-4o",
    color: "from-emerald-500/20 to-teal-500/10",
  },
  {
    id: "claude",
    name: "Claude",
    badge: "文学大师",
    desc: "claude-3-7-sonnet-20250219 · 细腻情感修辞与深度影评",
    icon: "🟣",
    defaultModel: "claude-3-7-sonnet-20250219",
    color: "from-purple-500/20 to-violet-500/10",
  },
  {
    id: "gemini",
    name: "Gemini",
    badge: "百万帧感知",
    desc: "gemini-2.5-flash · 超长上下文全季连续梗概",
    icon: "🔷",
    defaultModel: "gemini-2.5-flash",
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "kimi",
    name: "Kimi · 月之暗面",
    badge: "长剧拆条",
    desc: "moonshot-v1-auto · 百万字原著改编与背景设定集",
    icon: "🌙",
    defaultModel: "moonshot-v1-auto",
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "glm5",
    name: "智谱 GLM",
    badge: "清华开源",
    desc: "glm-4-flash · 中文影视剧本与情感递进深度调优",
    icon: "🔮",
    defaultModel: "glm-4-flash",
    color: "from-indigo-500/20 to-purple-500/10",
  },
  {
    id: "doubao",
    name: "豆包 Doubao",
    badge: "字节短剧",
    desc: "doubao-pro-32k · 抖音快手高完播率解说",
    icon: "📦",
    defaultModel: "doubao-pro-32k",
    color: "from-rose-500/20 to-pink-500/10",
  },
  {
    id: "hunyuan",
    name: "混元 Hunyuan",
    badge: "腾讯旗舰",
    desc: "hunyuan-standard · 腾讯多模态结构化剧情生成",
    icon: "🐧",
    defaultModel: "hunyuan-standard",
    color: "from-blue-600/20 to-cyan-500/10",
  },
  {
    id: "local",
    name: "本地 Ollama",
    badge: "私有离线",
    desc: "llama3.2 / qwen2.5 (127.0.0.1:11434)",
    icon: "💻",
    defaultModel: "llama3.2",
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
