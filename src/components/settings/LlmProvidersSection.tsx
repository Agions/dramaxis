import { useState } from "react";
import { settingsIpc, type ConfigSnapshot, type LlmTestResult } from "@dramaxis/ipc";
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

interface LlmProvidersSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export function LlmProvidersSection({
  form,
  setForm,
}: LlmProvidersSectionProps) {
  const [showKey, setShowKey] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

  const currentLlm =
    LLM_OPTIONS.find((o) => o.id === form.llm_provider) ?? LLM_OPTIONS[0]!;

  const handleTestConnection = async () => {
    if (!form.llm_api_key && form.llm_provider !== "local") {
      toast.error("请先填写 API Key 后再测试连通性");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const toastId = toast.loading(`正在测试与 ${currentLlm.name} 的连通性...`);
    try {
      const res = await settingsIpc.testLlm({
        provider: form.llm_provider,
        apiKey: form.llm_api_key || "no-key-required",
        model: form.llm_model || currentLlm.defaultModel,
        baseUrl: form.llm_base_url || null,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(
          `✓ ${currentLlm.name} 连通正常 (${res.latencyMs}ms)`,
          { id: toastId },
        );
      } else {
        toast.error(`连通失败: ${res.message}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`连通异常: ${err?.message || String(err)}`, { id: toastId });
    } finally {
      setTesting(false);
    }
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-secondary">
                指定模型名称 (Model)
              </label>
              {form.llm_provider === "custom" && (
                <span className="text-[10px] text-gold font-medium">
                  可填任意 OpenAI 兼容模型
                </span>
              )}
            </div>
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
            {form.llm_provider === "custom" && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-text-muted">常用快捷填入:</span>
                {[
                  "deepseek-chat",
                  "deepseek-reasoner",
                  "gpt-4o",
                  "gpt-4o-mini",
                  "qwen-plus",
                  "claude-3-5-sonnet-20241022",
                ].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, llm_model: m }))}
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-muted hover:bg-gold/20 hover:text-gold text-text-secondary border border-border transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
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
            placeholder={
              form.llm_provider === "custom"
                ? "如 https://api.siliconflow.cn/v1 或中转代理地址 (必填)"
                : "留空使用官方默认地址 (如 https://api.openai.com/v1)"
            }
            className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
          />
        </div>

        {/* 连通性测试与快速诊断栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-2 rounded-xl bg-gold/10 hover:bg-gold/20 border border-gold/40 px-4 py-2 text-xs font-bold text-gold transition-colors disabled:opacity-50"
            >
              <span>{testing ? "⚡ 正在测速中..." : "⚡ 测试大模型连通性"}</span>
            </button>
            <span className="text-[11px] text-text-muted">
              发送轻量探针测试 Token 与往返延迟
            </span>
          </div>

          {testResult && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium ${
                  testResult.success
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}
              >
                <span>{testResult.success ? "✓" : "✗"}</span>
                <span>{testResult.latencyMs}ms</span>
                <span className="text-text-muted">|</span>
                <span className="truncate max-w-[200px]" title={testResult.message}>
                  {testResult.message}
                </span>
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 异构智能体专精模型矩阵 (高级专精配置) */}
      <Card className="space-y-4">
        <div
          onClick={() => setShowMatrix(!showMatrix)}
          className="flex items-center justify-between cursor-pointer select-none pb-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🧬</span>
            <div>
              <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>异构智能体专精模型矩阵 (Agent Model Matrix)</span>
                <Badge variant="gold">高阶专精</Badge>
              </div>
              <div className="text-[11px] text-text-secondary">
                为编剧、视觉分析、审稿质检单独指定专精模型（留空则自动继承上方全局默认配置）
              </div>
            </div>
          </div>
          <button
            type="button"
            className="text-xs text-gold font-bold hover:underline"
          >
            {showMatrix ? "收起矩阵 ▲" : "展开配置 ▼"}
          </button>
        </div>

        {showMatrix && (
          <div className="space-y-4 pt-2 border-t border-border">
            {[
              {
                key: "screenwriter" as const,
                title: "✍️ 金牌编剧 (Screenwriter)",
                desc: "专精文学创作与高反转剧情，推荐 DeepSeek-V3 / Claude 3.5 Sonnet / Qwen-Plus",
                defaultPlaceholder: "如 deepseek-chat 或 claude-3-5-sonnet",
              },
              {
                key: "visualCritic" as const,
                title: "👁️ 视觉分析师 (VisualCritic)",
                desc: "专精多模态关键帧视听锚定，推荐 Gemini 2.5 Flash / Qwen-VL / Doubao-Vision",
                defaultPlaceholder: "如 gemini-2.5-flash 或 qwen-vl-max",
              },
              {
                key: "qualityReviewer" as const,
                title: "🔍 审稿质检员 (QualityReviewer)",
                desc: "专精严谨逻辑推理、爆点留存曲线评估，推荐 DeepSeek-R1 / OpenAI o1-mini",
                defaultPlaceholder: "如 deepseek-reasoner 或 o1-mini",
              },
              {
                key: "director" as const,
                title: "🎬 总控统筹导演 (Director)",
                desc: "专精快速任务规划与工具调用，推荐 Qwen-Turbo / GPT-4o-mini",
                defaultPlaceholder: "如 qwen-turbo 或 gpt-4o-mini",
              },
            ].map((role) => {
              const currentOverride = form.agent_model_matrix?.[role.key];
              return (
                <div
                  key={role.key}
                  className="p-3 rounded-xl border border-border/70 bg-surface-elevated/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-text-primary">
                        {role.title}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {role.desc}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-text-secondary">
                        专精模型名称 (Model)
                      </label>
                      <input
                        type="text"
                        value={currentOverride?.model || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setForm((prev) => ({
                            ...prev,
                            agent_model_matrix: {
                              ...prev.agent_model_matrix,
                              [role.key]: {
                                ...prev.agent_model_matrix?.[role.key],
                                model: val,
                              },
                            },
                          }));
                        }}
                        placeholder={role.defaultPlaceholder}
                        className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-gold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-text-secondary">
                        专精 Base URL (可选覆盖)
                      </label>
                      <input
                        type="text"
                        value={currentOverride?.baseUrl || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setForm((prev) => ({
                            ...prev,
                            agent_model_matrix: {
                              ...prev.agent_model_matrix,
                              [role.key]: {
                                ...prev.agent_model_matrix?.[role.key],
                                baseUrl: val,
                              },
                            },
                          }));
                        }}
                        placeholder="留空继承全局默认 Base URL"
                        className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
