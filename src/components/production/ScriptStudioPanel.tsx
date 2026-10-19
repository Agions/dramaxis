/**
 * splicr v1.0.1 · ScriptStudioPanel · AI 独白与剧本创作工坊
 *
 * 核心功能:
 * - 11 大主流 LLM 大模型选择 (Qwen 3.8 / GPT-5.6 / DeepSeek V4...)
 * - 4 种第一人称叙事风格 (沉浸 / 深度解析 / 悬疑反转 / 幽默吐槽)
 * - 提示词与剧情脉络输入
 * - 流式文案编辑与一键复制
 * - 自反思评分回路
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { scriptIpc, type HookCandidate } from "@dramaxis/ipc";

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
}: ScriptStudioPanelProps) {
  const [hooks, setHooks] = useState<HookCandidate[]>([]);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [selectedHookIndex, setSelectedHookIndex] = useState<number | null>(null);

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    try {
      const candidates = await scriptIpc.generateHooks(userPrompt || "这个故事");
      setHooks(candidates);
      setSelectedHookIndex(null);
      toast.success("成功生成 4 大公式爆款 Hook (0~3s 黄金留存)");
    } catch (e) {
      toast.error(`生成 Hook 失败: ${String(e)}`);
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleApplyHook = (hook: HookCandidate, index: number) => {
    setSelectedHookIndex(index);
    const trimmed = scriptText.trim();
    if (!trimmed) {
      onScriptTextChange(hook.hookText + "\n\n");
    } else {
      // 若已有文案，将黄金 Hook 作为首句置顶插入
      onScriptTextChange(`${hook.hookText}\n\n${trimmed}`);
    }
    toast.success(`已采纳【${hook.formulaName}】为黄金 3 秒开场！`);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          大模型选择
        </label>
        <select
          value={llmProvider}
          onChange={(e) => onLlmProviderChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-gold"
        >
          <option value="qwen">通义千问 (qwen3.8-max 推荐)</option>
          <option value="deepseek">DeepSeek (deepseek-v4-pro)</option>
          <option value="open-ai">OpenAI (gpt-5.6-sol)</option>
          <option value="claude">Claude (claude-sonnet-5)</option>
          <option value="gemini">Gemini (gemini-3.6-flash)</option>
        </select>
      </div>

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

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          提示词 / 剧情脉络
        </label>
        <input
          type="text"
          value={userPrompt}
          onChange={(e) => onUserPromptChange(e.target.value)}
          placeholder="输入剧本核心梗概、情感走向..."
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-primary outline-none focus:border-gold"
        />
      </div>

      {/* 黄金 3 秒爆款 Hook 开场公式引擎 */}
      <div className="rounded-xl border border-border bg-bg/80 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary">
              🎯 黄金 3 秒爆款 Hook 引擎
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
              0~3s 留存率倍增
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerateHooks}
            disabled={isGeneratingHooks}
            className="text-[10px] font-bold text-gold hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            {isGeneratingHooks ? "⚡ 计算中..." : "⚡ 一键推导 4 大公式"}
          </button>
        </div>

        {hooks.length > 0 ? (
          <div className="space-y-2">
            {hooks.map((h, idx) => {
              const isSelected = selectedHookIndex === idx;
              const badgeColor =
                h.formula === "result_first"
                  ? "text-red-400 border-red-500/30 bg-red-500/10"
                  : h.formula === "counter_intuitive"
                  ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                  : h.formula === "high_stakes_empathy"
                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  : "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";

              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-2.5 text-xs transition-all ${
                    isSelected
                      ? "border-gold bg-gold/10 shadow-sm"
                      : "border-border bg-surface hover:border-gold/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}
                    >
                      {h.formulaName}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-gold">
                      {h.estimatedRetentionScore}% 预估留存
                    </span>
                  </div>
                  <p className="text-[11px] text-text-primary leading-relaxed font-medium mb-2">
                    "{h.hookText}"
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span className="truncate max-w-[220px]">
                      💡 {h.strategyReason}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyHook(h, idx)}
                      className="px-2 py-0.5 rounded bg-gold/20 hover:bg-gold/30 text-gold font-bold text-[10px] transition-colors"
                    >
                      {isSelected ? "✓ 已采纳" : "采纳开场"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-surface/40 p-3 text-center">
            <p className="text-[11px] text-text-secondary mb-1">
              短视频算法完播率关键在于前 3 秒！
            </p>
            <p className="text-[10px] text-text-muted">
              点击上方「⚡ 一键推导 4 大公式」基于梗概实时计算高潮前置、认知颠覆、生存危机与强悬念候选。
            </p>
          </div>
        )}
      </div>

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
      </div>

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
