/**
 * dramaxis v1.1.0 · Few-Shot 对标爆款文案解构卡片 (ReferenceDeconstructCard)
 *
 * 核心功能:
 * - 参考爆款文案粘帖输入
 * - 实时提取平均句长、网感热词、语速画像与叙事结构
 * - 一键将解构画像注入提示词输入框
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { scriptIpc, type StyleProfile } from "@dramaxis/ipc";

interface ReferenceDeconstructCardProps {
  userPrompt: string;
  onUserPromptChange: (newPrompt: string) => void;
}

export const ReferenceDeconstructCard = memo(
  function ReferenceDeconstructCard({
    userPrompt,
    onUserPromptChange,
  }: ReferenceDeconstructCardProps) {
    const [showDeconstruct, setShowDeconstruct] = useState(false);
    const [referenceText, setReferenceText] = useState("");
    const [isDeconstructing, setIsDeconstructing] = useState(false);
    const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);

    const handleDeconstruct = async () => {
      if (!referenceText.trim()) {
        toast.warning("请输入对标爆款剧本文案");
        return;
      }
      setIsDeconstructing(true);
      try {
        const profile = await scriptIpc.deconstructReference(referenceText);
        setStyleProfile(profile);
        toast.success(`爆款风格画像解构成功：${profile.titleOrGenre}`);
      } catch (e) {
        toast.error(`解构失败: ${String(e)}`);
      } finally {
        setIsDeconstructing(false);
      }
    };

    const handleApplyStyleToPrompt = () => {
      if (!styleProfile) return;
      const addition = `\n\n【对标爆款风格画像】\n流派：${styleProfile.titleOrGenre}\n特征：${styleProfile.formulaSummary}\n指导：${styleProfile.fewShotPrompt}`;
      onUserPromptChange((userPrompt + addition).trim());
      toast.success("已将对标爆款画像注入提示词输入框！");
    };

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-text-secondary">
            提示词 / 剧情脉络
          </label>
          <button
            type="button"
            onClick={() => setShowDeconstruct(!showDeconstruct)}
            className="text-[10px] text-gold hover:underline font-medium"
          >
            {showDeconstruct ? "收起对标解构 ▲" : "🔍 对标爆款 Few-Shot 解构 ▼"}
          </button>
        </div>
        <input
          type="text"
          value={userPrompt}
          onChange={(e) => onUserPromptChange(e.target.value)}
          placeholder="输入剧本核心梗概、情感走向..."
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-primary outline-none focus:border-gold"
        />

        {showDeconstruct && (
          <div className="rounded-xl border border-gold/40 bg-surface/70 p-3 space-y-2 mt-1.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gold flex items-center gap-1">
                <span>🎯</span> 爆款参考文案解构
              </span>
              <button
                type="button"
                onClick={handleDeconstruct}
                disabled={isDeconstructing}
                className="px-2 py-0.5 rounded bg-gold text-zinc-950 font-bold text-[10px] hover:brightness-110 disabled:opacity-50"
              >
                {isDeconstructing ? "解构中..." : "⚡ 一键解构画像"}
              </button>
            </div>
            <textarea
              rows={3}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="在此粘贴同赛道爆款解说词片段（自动提取均句长、网感词与情绪走向）..."
              className="w-full rounded-lg border border-border bg-bg p-2 text-[11px] text-text-primary outline-none focus:border-gold resize-none"
            />
            {styleProfile && (
              <div className="rounded-lg border border-border/80 bg-bg/80 p-2.5 space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">
                    画像: {styleProfile.titleOrGenre}
                  </span>
                  <span className="font-mono text-gold font-bold">
                    均句长: {styleProfile.avgSentenceLength}字 · 语速:{" "}
                    {styleProfile.estimatedWpm}字/分
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-text-muted">爆款热词:</span>
                  {styleProfile.viralKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className="text-text-secondary truncate max-w-[200px]">
                    {styleProfile.formulaSummary}
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyStyleToPrompt}
                    className="text-gold font-bold hover:underline"
                  >
                    + 注入提示词
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
