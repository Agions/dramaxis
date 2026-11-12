/**
 * dramaxis v1.1.0 · ScriptStudioPanel · AI 独白与剧本创作工坊 (瘦身聚合器)
 *
 * 核心功能:
 * - 11 大主流 LLM 大模型选择 (Qwen 3.8 / GPT-5.6 / DeepSeek V4...) 与连通性极速测速
 * - 4 种第一人称叙事风格 (沉浸 / 深度解析 / 悬疑反转 / 幽默吐槽)
 * - 聚合 ReferenceDeconstructCard (对标爆款解构)、HookEngineCard (黄金 3 秒 Hook) 与 RetentionArcCard (留存波形分析)
 * - 流式文案编辑与一键复制
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { settingsIpc, type Blackboard } from "@dramaxis/ipc";
import { HookEngineCard } from "./script/HookEngineCard";
import { ReferenceDeconstructCard } from "./script/ReferenceDeconstructCard";
import { RetentionArcCard } from "./script/RetentionArcCard";
import { ReflectionEvolutionCard } from "./script/ReflectionEvolutionCard";

interface ScriptStudioPanelProps {
  llmProvider: string;
  onLlmProviderChange: (val: string) => void;
  scriptStyle: "immersive" | "critic" | "story" | "roast";
  onScriptStyleChange: (
    val: "immersive" | "critic" | "story" | "roast",
  ) => void;
  userPrompt: string;
  onUserPromptChange: (val: string) => void;
  scriptText: string;
  onScriptTextChange: (val: string) => void;
  isGeneratingScript: boolean;
  onGenerateScript: () => void;
  blackboard?: Blackboard | null;
}

export const ScriptStudioPanel = memo(function ScriptStudioPanel({
  llmProvider,
  onLlmProviderChange,
  scriptStyle,
  onScriptStyleChange,
  userPrompt,
  onUserPromptChange,
  scriptText,
  onScriptTextChange,
  isGeneratingScript,
  onGenerateScript,
  blackboard,
}: ScriptStudioPanelProps) {
  // 模型连通性快速测速
  const [testingModel, setTestingModel] = useState(false);
  const [modelLatency, setModelLatency] = useState<number | null>(null);

  const handleQuickTest = async () => {
    setTestingModel(true);
    try {
      const cfg = await settingsIpc.get();
      const res = await settingsIpc.testLlm({
        provider: llmProvider,
        apiKey: cfg.llm_api_key || "no-key-required",
        model: cfg.llm_model,
        baseUrl: cfg.llm_base_url,
      });
      if (res.success) {
        setModelLatency(res.latencyMs);
        toast.success(`✓ ${llmProvider} 连通正常 (${res.latencyMs}ms)`);
      } else {
        setModelLatency(null);
        toast.error(`连通失败: ${res.message}，请在「设置」中检查 API Key`);
      }
    } catch (e: any) {
      toast.error(`测试异常: ${e?.message || String(e)}`);
    } finally {
      setTestingModel(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 1. 大模型选择与连通性测速 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-text-secondary">
            大模型选择
          </label>
          <div className="flex items-center gap-1.5">
            {modelLatency !== null && (
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {modelLatency}ms
              </span>
            )}
            <button
              type="button"
              disabled={testingModel}
              onClick={handleQuickTest}
              className="text-[11px] font-bold text-gold hover:text-gold-hover transition-colors disabled:opacity-50"
            >
              {testingModel ? "测速中..." : "⚡ 测速"}
            </button>
          </div>
        </div>
        <select
          value={llmProvider}
          onChange={(e) => onLlmProviderChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-gold"
        >
          <option value="qwen">通义千问 (qwen3.8-max 推荐)</option>
          <option value="deepseek">DeepSeek (deepseek-v4-pro / flash 强推理)</option>
          <option value="open-ai">OpenAI (gpt-5 / o3-mini)</option>
          <option value="claude">Claude (claude-sonnet-5-5 推荐)</option>
          <option value="gemini">Gemini (gemini-3.8-flash)</option>
          <option value="kimi">Kimi · 月之暗面 (kimi-k3.1-pro)</option>
          <option value="glm5">智谱 GLM (glm-5.3)</option>
          <option value="doubao">豆包 Doubao (doubao-seed-2-1-pro)</option>
          <option value="hunyuan">腾讯混元 (hy4 旗舰)</option>
          <option value="local">本地 Ollama (deepseek-r1 / qwq:32b)</option>
          <option value="custom">⚙️ 自定义模型 (OpenAI兼容/中转)</option>
        </select>
        {llmProvider === "custom" && (
          <div className="rounded-lg bg-surface-muted border border-border/80 p-2 text-[11px] text-text-secondary flex items-center justify-between">
            <span>⚙️ 自定义 OpenAI 兼容端点：将在「设置」中读取自定义 Base URL 与模型名称</span>
          </div>
        )}
      </div>

      {/* 2. 第一人称解说风格 */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          解说风格
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "immersive" as const, label: "第一人称沉浸" },
            { id: "critic" as const, label: "影视深度解析" },
            { id: "story" as const, label: "悬疑反转故事" },
            { id: "roast" as const, label: "幽默风趣吐槽" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScriptStyleChange(s.id)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${
                scriptStyle === s.id
                  ? "border-gold bg-gold-muted text-gold font-bold shadow-sm"
                  : "border-border bg-bg text-text-secondary hover:text-text-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 提示词与 Few-Shot 对标爆款解构卡片 */}
      <ReferenceDeconstructCard
        userPrompt={userPrompt}
        onUserPromptChange={onUserPromptChange}
      />

      {/* 4. 黄金 3 秒爆款 Hook 公式引擎卡片 */}
      <HookEngineCard
        userPrompt={userPrompt}
        scriptText={scriptText}
        onApplyHookText={onScriptTextChange}
      />

      {/* 5. 解说文案主编辑区 */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-text-secondary">
            解说文案编辑
          </label>
          {scriptText && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(scriptText);
                toast.success("文案已复制到剪贴板");
              }}
              className="text-[10px] text-gold hover:underline"
            >
              📋 复制
            </button>
          )}
        </div>
        <textarea
          value={scriptText}
          onChange={(e) => onScriptTextChange(e.target.value)}
          rows={8}
          placeholder="等待 AI 智能体生成或直接在此输入/编辑解说词..."
          className="w-full rounded-xl border border-border bg-bg p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-gold font-sans"
        />

        {/* 6. 留存曲线张力分析卡片 */}
        <RetentionArcCard scriptText={scriptText} />

        {/* 6.5. 智能体自反思演化轨迹卡片 (多轮 Critic 反思与版本回滚) */}
        <ReflectionEvolutionCard
          blackboard={blackboard}
          onApplyScript={onScriptTextChange}
        />
      </div>

      {/* 7. 重建 AI 剧本按钮 */}
      <button
        type="button"
        onClick={onGenerateScript}
        disabled={isGeneratingScript}
        className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
      >
        {isGeneratingScript
          ? "🤖 AI 正在生成独白剧本..."
          : "⚡ 重新生成 AI 剧本"}
      </button>
    </div>
  );
});
