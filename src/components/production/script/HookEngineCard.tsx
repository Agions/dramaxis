/**
 * dramaxis v1.1.0 · 黄金 3 秒爆款 Hook 公式引擎卡片 (HookEngineCard)
 *
 * 核心功能:
 * - 0~3s 黄金留存开篇推导 (结果前置 / 反常识 / 生存危机 / 极度共情)
 * - 候选卡片列表、预估留存率与策略解析
 * - 一键采纳置顶开篇
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { scriptIpc, type HookCandidate } from "@dramaxis/ipc";

interface HookEngineCardProps {
  userPrompt: string;
  scriptText: string;
  onApplyHookText: (newText: string) => void;
}

export const HookEngineCard = memo(function HookEngineCard({
  userPrompt,
  scriptText,
  onApplyHookText,
}: HookEngineCardProps) {
  const [hooks, setHooks] = useState<HookCandidate[]>([]);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [selectedHookIndex, setSelectedHookIndex] = useState<number | null>(
    null,
  );

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    try {
      const candidates = await scriptIpc.generateHooks(
        userPrompt || "这个故事",
      );
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
      onApplyHookText(hook.hookText + "\n\n");
    } else {
      // 若已有文案，将黄金 Hook 作为首句置顶插入
      onApplyHookText(`${hook.hookText}\n\n${trimmed}`);
    }
    toast.success(`已采纳【${hook.formulaName}】为黄金 3 秒开场！`);
  };

  return (
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
  );
});
