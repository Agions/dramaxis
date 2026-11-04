/**
 * dramaxis v1.2.0 · AgentModelMatrixCard
 *
 * 异构智能体专精模型矩阵配置卡片 (可折叠)
 */

import { memo, useState } from "react";
import { Badge, Card } from "@dramaxis/ui";
import type { ConfigSnapshot } from "@dramaxis/ipc";

const AGENT_ROLES = [
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
];

interface AgentModelMatrixCardProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export const AgentModelMatrixCard = memo(function AgentModelMatrixCard({
  form,
  setForm,
}: AgentModelMatrixCardProps) {
  const [showMatrix, setShowMatrix] = useState(false);

  return (
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
              为编剧、视觉分析、审稿质检单独指定专精模型（留空则自动继承全局默认配置）
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
          {AGENT_ROLES.map((role) => {
            const currentOverride = form.agent_model_matrix?.[role.key];
            return (
              <div
                key={role.key}
                className="p-3 rounded-xl border border-border/70 bg-surface-elevated/40 space-y-2.5"
              >
                <div>
                  <div className="text-xs font-bold text-text-primary">
                    {role.title}
                  </div>
                  <div className="text-[10px] text-text-muted">{role.desc}</div>
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
  );
});
