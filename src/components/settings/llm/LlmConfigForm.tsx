/**
 * dramaxis v1.2.0 · LlmConfigForm
 *
 * 模型详细参数配置卡片 (API Key / Model / Base URL / 连通性测试)
 */

import { memo, useState } from "react";
import { Card } from "@dramaxis/ui";
import type { ConfigSnapshot, LlmTestResult } from "@dramaxis/ipc";
import type { LlmMeta } from "./llmOptions";

const QUICK_MODELS = [
  "deepseek-v4-pro",
  "deepseek-flash",
  "gpt-5",
  "o3-mini",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
  "qwen3.8-max",
  "qwen3.7-plus",
  "qwen3.8-omni-flash",
  "kimi-k3.1-pro",
  "glm-5.3",
  "glm-5.3-flash",
  "doubao-seed-2-1-pro-260915",
  "hy4",
  "deepseek-r1:14b",
];

interface LlmConfigFormProps {
  currentLlm: LlmMeta;
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
  testing: boolean;
  testResult: LlmTestResult | null;
  onTestConnection: () => void;
}

export const LlmConfigForm = memo(function LlmConfigForm({
  currentLlm,
  form,
  setForm,
  testing,
  testResult,
  onTestConnection,
}: LlmConfigFormProps) {
  const [showKey, setShowKey] = useState(false);

  return (
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
          onClick={onTestConnection}
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
              {QUICK_MODELS.map((m) => (
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
            onClick={onTestConnection}
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
              <span
                className="truncate max-w-[200px]"
                title={testResult.message}
              >
                {testResult.message}
              </span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
