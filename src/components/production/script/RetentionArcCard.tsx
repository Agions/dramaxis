/**
 * dramaxis v1.1.0 · 留存曲线张力分析卡片 (RetentionArcCard)
 *
 * 核心功能:
 * - 四维留存评分指标 (0~3s Hook / 3~15s 代入 / 15~45s 高潮 / 45s+ 悬念)
 * - 动态 SVG 折线波形曲线绘制
 * - 综合完播留存指数测算
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { scriptIpc, type RetentionTensionArc } from "@dramaxis/ipc";

interface RetentionArcCardProps {
  scriptText: string;
}

export const RetentionArcCard = memo(function RetentionArcCard({
  scriptText,
}: RetentionArcCardProps) {
  const [retentionArc, setRetentionArc] = useState<RetentionTensionArc | null>(
    null,
  );
  const [isAnalyzingArc, setIsAnalyzingArc] = useState(false);

  const handleCalculateRetentionArc = async () => {
    if (!scriptText.trim()) {
      toast.warning("文案为空，无法计算留存曲线");
      return;
    }
    setIsAnalyzingArc(true);
    try {
      const arc = await scriptIpc.calculateRetentionArc(scriptText, 60.0);
      setRetentionArc(arc);
      toast.success(
        `留存曲线计算完成！综合留存指数: ${arc.overallRetentionIndex.toFixed(1)}%`,
      );
    } catch (e) {
      toast.error(`计算留存曲线失败: ${String(e)}`);
    } finally {
      setIsAnalyzingArc(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
          <span>📈</span> 留存曲线张力分析 (Retention Arc)
        </span>
        <button
          type="button"
          onClick={handleCalculateRetentionArc}
          disabled={isAnalyzingArc || !scriptText.trim()}
          className="text-[10px] font-bold text-gold hover:underline disabled:opacity-50"
        >
          {isAnalyzingArc ? "⏳ 计算中..." : "⚡ 测评留存波形"}
        </button>
      </div>

      {retentionArc ? (
        <div className="space-y-2.5">
          {/* 四维留存评分指标 */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5">
              <div className="text-[9px] text-text-muted">0~3s Hook</div>
              <div className="font-mono text-xs font-bold text-red-400">
                {retentionArc.hookScore.toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-1.5">
              <div className="text-[9px] text-text-muted">3~15s 代入</div>
              <div className="font-mono text-xs font-bold text-amber-400">
                {retentionArc.setupEmpathyScore.toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-1.5">
              <div className="text-[9px] text-text-muted">15~45s 高潮</div>
              <div className="font-mono text-xs font-bold text-purple-400">
                {retentionArc.climaxIntensity.toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-1.5">
              <div className="text-[9px] text-text-muted">45s+ 悬念</div>
              <div className="font-mono text-xs font-bold text-cyan-400">
                {retentionArc.cliffhangerRetention.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* 留存波形曲线 (SVG 动态渲染) */}
          <div className="relative h-16 w-full rounded-lg bg-bg border border-border/80 px-2 py-1 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[8px] font-mono text-text-muted">
              <span>开篇 Hook</span>
              <span>痛点展开</span>
              <span>冲突爆发</span>
              <span>反转悬念</span>
            </div>
            <svg
              className="w-full h-8 overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 40"
            >
              <defs>
                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="25%" stopColor="#f59e0b" />
                  <stop offset="70%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={retentionArc.curvePoints
                  .map((pt, i, arr) => {
                    const x = (i / Math.max(1, arr.length - 1)) * 100;
                    const y = 40 - (pt.tensionLevel / 100) * 36;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ")}
              />
              {retentionArc.curvePoints.map((pt, i, arr) => {
                const x = (i / Math.max(1, arr.length - 1)) * 100;
                const y = 40 - (pt.tensionLevel / 100) * 36;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="2.5"
                    fill="#fbbf24"
                    stroke="#09090b"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
            <div className="flex justify-between items-center text-[9px]">
              <span className="font-bold text-text-secondary">
                综合爆款留存指数:
              </span>
              <span className="font-mono font-bold text-gold">
                {retentionArc.overallRetentionIndex.toFixed(1)}% 完播可能
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-text-muted text-center py-1">
          生成或输入文案后，点击右上角「⚡ 测评留存波形」评估完播留存张力。
        </p>
      )}
    </div>
  );
});
