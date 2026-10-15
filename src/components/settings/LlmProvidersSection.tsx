import { useState } from "react";
import { scriptIpc, type ConfigSnapshot } from "@dramaxis/ipc";
import { Badge, Card } from "@dramaxis/ui";
import { toast } from "sonner";

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
    desc: "claude-sonnet-4-20250514 · 细腻情感修辞与深度影评",
    icon: "🟣",
    defaultModel: "claude-sonnet-4-20250514",
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
];

interface LlmProvidersSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export function LlmProvidersSection({
  form,
  setForm,
}: LlmProvidersSectionProps) {
  const [showKey, setShowKey] = useState(false);
  const currentLlm =
    LLM_OPTIONS.find((o) => o.id === form.llm_provider) ?? LLM_OPTIONS[0]!;

  const handleTestConnection = () => {
    if (!form.llm_api_key && form.llm_provider !== "local") {
      toast.error("请先填写 API Key 后再测试连通性");
      return;
    }
    toast.promise(
      scriptIpc.generate({
        provider: form.llm_provider,
        apiKey: form.llm_api_key ?? null,
        baseUrl: form.llm_base_url ?? null,
        model: form.llm_model ?? null,
        prompt: "你好，请回复'pong'进行连通性测试",
        style: null,
        emotionDensity: null,
        wordCountTarget: 10,
        hookStyle: null,
        includeHook: false,
        imagesBase64: null,
      }),
      {
        loading: `正在测试与 ${currentLlm.name} 的连通性...`,
        success: (res) =>
          `✓ ${currentLlm.name} 连通正常 (响应: ${res.text.slice(0, 20)}...)`,
        error: (err) =>
          `连通性测试失败: ${err?.message ?? "请检查 API Key 或网络"}`,
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* 厂商网格 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {LLM_OPTIONS.map((item) => {
          const selected = form.llm_provider === item.id;
          return (
            <Card
              key={item.id}
              interactive
              glow={selected}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  llm_provider: item.id,
                  llm_model:
                    prev.llm_provider === item.id
                      ? prev.llm_model
                      : item.defaultModel,
                }))
              }
              className={`p-3 text-left ${selected ? "border-gold bg-gold-muted" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{item.icon}</span>
                <Badge variant={selected ? "gold" : "zinc"}>{item.badge}</Badge>
              </div>
              <div className="mt-2 text-xs font-bold text-text-primary truncate">
                {item.name}
              </div>
              <div className="text-[10px] text-text-secondary truncate mt-0.5">
                {item.desc}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 参数配置卡片 */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentLlm.icon}</span>
            <div>
              <div className="text-sm font-bold text-text-primary">
                {currentLlm.name} 详细参数
              </div>
              <div className="text-[11px] text-text-secondary">
                {currentLlm.desc}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            className="rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-text-primary transition hover:border-gold active:scale-95"
          >
            ⚡ 测试连通性
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              API Key 凭据
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={form.llm_api_key || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    llm_api_key: e.target.value || null,
                  }))
                }
                placeholder={`请输入 ${currentLlm.name} API Key (sk-...)`}
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

          {/* 指定模型 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              指定模型名称 (Model)
            </label>
            <input
              type="text"
              value={form.llm_model || currentLlm.defaultModel}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  llm_model: e.target.value || null,
                }))
              }
              placeholder={currentLlm.defaultModel}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        {/* 自定义 Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary">
            自定义 API Base URL (代理与中转加速)
          </label>
          <input
            type="text"
            value={form.llm_base_url || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                llm_base_url: e.target.value || null,
              }))
            }
            placeholder="留空使用官方默认地址 (如 https://api.openai.com/v1)"
            className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
          />
        </div>
      </Card>
    </div>
  );
}
