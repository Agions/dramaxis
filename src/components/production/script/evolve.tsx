/**
 * dramaxis v1.2.0 · 智能体自反思演化谱系卡片 (ReflectionEvolutionCard)
 *
 * 核心功能:
 * - 多轮 Critic-Screenwriter 反思演化版本链可视化 (v1 -> v2 -> v3)
 * - 0~3s Hook / 语速节奏 / 冲突张力多维评分跃迁对比
 * - 文学裁判批评打回意见 (Critique Feedback) 与落地修改建议清单
 * - 一键版本回滚 (Rollback) 与剧本采纳应用
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { agentIpc, type Blackboard, type ScriptArtifact } from "@dramaxis/ipc";
import { Badge } from "@dramaxis/ui";

interface ReflectionEvolutionCardProps {
  blackboard: Blackboard | null | undefined;
  onApplyScript?: (text: string) => void;
  onRefreshBlackboard?: () => void;
}

export const ReflectionEvolutionCard = memo(function ReflectionEvolutionCard({
  blackboard,
  onApplyScript,
  onRefreshBlackboard,
}: ReflectionEvolutionCardProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  if (!blackboard || !blackboard.scriptVersions || blackboard.scriptVersions.length === 0) {
    return null;
  }

  const versions: ScriptArtifact[] = blackboard.scriptVersions;
  const firstVer = versions[0];
  if (!firstVer) {
    return null;
  }

  const activeIndex = blackboard.activeScriptIndex ?? versions.length - 1;
  const currentActive: ScriptArtifact =
    versions[activeIndex] ?? versions[versions.length - 1] ?? firstVer;

  const currentDisplay: ScriptArtifact =
    (selectedVersion != null
      ? versions.find((v) => v.version === selectedVersion)
      : null) ?? currentActive;

  const handleRollback = async (version: number) => {
    setIsRollingBack(true);
    try {
      const ok = await agentIpc.rollbackScript(version);
      if (ok) {
        toast.success(`已回滚生效剧本至 v${version}`);
        setSelectedVersion(version);
        if (onRefreshBlackboard) {
          onRefreshBlackboard();
        }
      } else {
        toast.error(`回滚至 v${version} 失败`);
      }
    } catch (e) {
      toast.error(`回滚异常: ${String(e)}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3 space-y-2.5 mt-2 transition-all">
      {/* 头部标题与版本轮次总览 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🔄</span>
          <span className="text-xs font-bold text-text-primary">
            剧本自反思演化轨迹 (Critic Reflection)
          </span>
          <Badge variant="gold">共 {versions.length} 轮</Badge>
        </div>
        <span className="text-[10px] text-text-muted">
          当前生效: <span className="font-mono text-gold font-bold">v{currentActive.version}</span>
        </span>
      </div>

      {/* 版本时间轴选择器 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
        {versions.map((ver) => {
          const isSelected = currentDisplay.version === ver.version;
          const isActive = currentActive.version === ver.version;
          const score = ver.estimatedRetention ?? 0;

          return (
            <button
              key={ver.version}
              type="button"
              onClick={() => setSelectedVersion(ver.version)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
                isSelected
                  ? "border-gold bg-gold/15 text-gold shadow-sm font-bold"
                  : "border-border bg-bg/80 text-text-secondary hover:border-gold/50"
              }`}
            >
              <span>v{ver.version}</span>
              <span className={`text-[10px] ${score >= 88 ? "text-emerald-400" : score >= 80 ? "text-amber-400" : "text-rose-400"}`}>
                {score.toFixed(0)}分
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="当前主线激活" />
              )}
            </button>
          );
        })}
      </div>

      {/* 选中版本多维指标卡片 */}
      <div className="rounded-lg border border-border/80 bg-bg/70 p-2.5 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
          <span className="font-bold text-text-primary flex items-center gap-1">
            <span>第 {currentDisplay.version} 轮产物评估</span>
            {currentDisplay.version === currentActive.version ? (
              <span className="text-[10px] text-emerald-400 font-normal">(主线激活)</span>
            ) : (
              <span className="text-[10px] text-text-muted font-normal">(历史存档)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted font-mono">
              {currentDisplay.text.length} 字
            </span>
            {currentDisplay.version !== currentActive.version && (
              <button
                type="button"
                disabled={isRollingBack}
                onClick={() => handleRollback(currentDisplay.version)}
                className="text-[10px] text-gold hover:underline disabled:opacity-50 font-bold"
              >
                {isRollingBack ? "回滚中..." : "↺ 回滚至此版"}
              </button>
            )}
            {onApplyScript && (
              <button
                type="button"
                onClick={() => {
                  onApplyScript(currentDisplay.text);
                  toast.success(`已载入 v${currentDisplay.version} 剧本文案至主编辑器`);
                }}
                className="text-[10px] text-emerald-400 hover:underline font-bold"
              >
                ✓ 应用文案
              </button>
            )}
          </div>
        </div>

        {/* 四维评分指标仪表盘 */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="rounded border border-border/50 bg-surface/50 p-1">
            <div className="text-[10px] text-text-muted">综合留存</div>
            <div className="font-mono font-bold text-gold text-xs">
              {(currentDisplay.estimatedRetention ?? 0).toFixed(1)}
            </div>
          </div>
          <div className="rounded border border-border/50 bg-surface/50 p-1">
            <div className="text-[10px] text-text-muted">0~3s Hook</div>
            <div className="font-mono font-bold text-xs text-text-primary">
              {(currentDisplay.hookScore ?? currentDisplay.estimatedRetention ?? 0).toFixed(1)}
            </div>
          </div>
          <div className="rounded border border-border/50 bg-surface/50 p-1">
            <div className="text-[10px] text-text-muted">语速节奏</div>
            <div className="font-mono font-bold text-xs text-text-primary">
              {(currentDisplay.pacingScore ?? 88.0).toFixed(1)}
            </div>
          </div>
          <div className="rounded border border-border/50 bg-surface/50 p-1">
            <div className="text-[10px] text-text-muted">冲突张力</div>
            <div className="font-mono font-bold text-xs text-text-primary">
              {(currentDisplay.conflictScore ?? 85.0).toFixed(1)}
            </div>
          </div>
        </div>

        {/* 裁判批评反馈 (Critique Feedback) */}
        {currentDisplay.critiqueFeedback && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200/90 leading-relaxed">
            <div className="font-bold flex items-center gap-1 text-amber-400 pb-0.5">
              <span>⚖️ 文学裁判批注:</span>
            </div>
            <div>{currentDisplay.critiqueFeedback}</div>
          </div>
        )}

        {/* 结构化修改建议清单 */}
        {currentDisplay.critiqueSuggestions && currentDisplay.critiqueSuggestions.length > 0 && (
          <div className="space-y-1 pt-0.5">
            <div className="text-[10px] text-text-muted font-bold">🎯 落地修改建议:</div>
            <ul className="list-disc list-inside text-[11px] text-text-secondary space-y-0.5">
              {currentDisplay.critiqueSuggestions.map((sug, idx) => (
                <li key={idx} className="leading-snug">{sug}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 文案片段预览 */}
        <div className="pt-1">
          <div className="text-[10px] text-text-muted pb-1">文案摘要 (开篇黄金3秒 Hook):</div>
          <p className="text-[11px] text-text-primary/90 bg-bg p-2 rounded border border-border/60 max-h-20 overflow-y-auto font-mono whitespace-pre-wrap">
            {currentDisplay.text}
          </p>
        </div>
      </div>
    </div>
  );
});
