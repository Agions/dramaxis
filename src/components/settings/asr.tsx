/**
 * dramaxis v1.3.0 · 设置中心 · ASR 语音识别引擎配置区 (AsrSection)
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { useState } from "react";
import { settingsIpc, type AsrTestResult, type ConfigSnapshot } from "@dramaxis/ipc";
import { Card } from "@dramaxis/ui";

interface AsrSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export const ASR_PROVIDERS = [
  {
    id: "auto",
    label: "智能三级降级 (推荐)",
    desc: "优先伴随 SRT → 本地 whisper.cpp 离线 → 云端/局域网 API",
    badge: "Auto",
    icon: "⚡",
  },
  {
    id: "whisper_cli",
    label: "本地 whisper-cli (whisper.cpp)",
    desc: "完全离线零成本、高并发槽位背压，支持 Metal/CUDA 毫秒对齐",
    badge: "Local",
    icon: "💻",
  },
  {
    id: "api",
    label: "OpenAI / SenseVoice 兼容端点",
    desc: "支持云端 Whisper-1 或内网 GPU 算力集群 HTTP API",
    badge: "Cloud",
    icon: "☁️",
  },
  {
    id: "srt",
    label: "仅读取伴随 .srt 字幕",
    desc: "原片同目录存在同名 .srt 时直读，适合已有台词轴的素材",
    badge: "File",
    icon: "📄",
  },
];

export function AsrSection({ form, setForm }: AsrSectionProps) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AsrTestResult | null>(null);

  const currentProvider = form.asr_provider || "auto";

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await settingsIpc.testAsr({
        provider: currentProvider,
        whisperCliPath: form.asr_whisper_cli_path ?? null,
        whisperModelPath: form.asr_whisper_model_path ?? null,
        apiBaseUrl: form.asr_api_base_url ?? null,
        apiKey: form.asr_api_key ?? null,
        apiModel: form.asr_api_model ?? null,
      });
      setTestResult(res);
    } catch (e) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 引擎通道选择卡片 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ASR_PROVIDERS.map((item) => {
          const active = currentProvider === item.id;
          return (
            <div
              key={item.id}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  asr_provider: item.id,
                }))
              }
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 select-none ${
                active
                  ? "border-gold/60 bg-gold/10 shadow-lg shadow-gold/5"
                  : "border-border bg-surface hover:border-gold/30 hover:bg-surface-elevated"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-bold text-text-primary">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    active
                      ? "bg-gold text-bg-dark font-extrabold"
                      : "bg-surface-elevated text-text-secondary"
                  }`}
                >
                  {item.badge}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* 参数详细配置卡片 */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <div className="text-sm font-bold text-text-primary">
              ASR 语音转写与台词提取参数
            </div>
            <div className="text-[11px] text-text-secondary">
              配置离线执行器或云端端点，赋能编剧 Agent 听觉理解与原声金句提取
            </div>
          </div>
          <button
            type="button"
            disabled={testing}
            onClick={handleTest}
            className="rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-text-primary transition hover:border-gold active:scale-95 disabled:opacity-50"
          >
            {testing ? "⌛ 探测中..." : "⚡ 连通性 / 模型探测"}
          </button>
        </div>

        {/* 探测结果提示 */}
        {testResult && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
              testResult.success
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            <span>{testResult.message}</span>
            <span className="text-[10px] opacity-75 font-mono">
              {testResult.latencyMs}ms
            </span>
          </div>
        )}

        {/* 本地 Whisper-cli 配置 */}
        {(currentProvider === "whisper_cli" || currentProvider === "auto") && (
          <div className="space-y-3 rounded-xl border border-border/40 bg-surface/40 p-3.5">
            <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <span>💻</span> 本地 whisper.cpp (whisper-cli) 离线配置
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary">
                  whisper-cli 可执行路径
                </label>
                <input
                  type="text"
                  value={form.asr_whisper_cli_path || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      asr_whisper_cli_path: e.target.value || null,
                    }))
                  }
                  placeholder="默认使用环境变量中的 whisper-cli"
                  className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary">
                  Whisper 模型文件路径 (.bin)
                </label>
                <input
                  type="text"
                  value={form.asr_whisper_model_path || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      asr_whisper_model_path: e.target.value || null,
                    }))
                  }
                  placeholder="例如: /models/ggml-large-v3-turbo.bin"
                  className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 远端 / API 配置 */}
        {(currentProvider === "api" || currentProvider === "auto") && (
          <div className="space-y-3 rounded-xl border border-border/40 bg-surface/40 p-3.5">
            <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <span>☁️</span> OpenAI 兼容 Whisper HTTP API 配置
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary">
                  API 端点 (Base URL)
                </label>
                <input
                  type="text"
                  value={form.asr_api_base_url || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      asr_api_base_url: e.target.value || null,
                    }))
                  }
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary">
                  模型名称 (Model)
                </label>
                <input
                  type="text"
                  value={form.asr_api_model || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      asr_api_model: e.target.value || null,
                    }))
                  }
                  placeholder="whisper-1"
                  className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-secondary">
                API Key (密钥将安全加密保存在系统受限凭据金库中)
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={form.asr_api_key || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      asr_api_key: e.target.value || null,
                    }))
                  }
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary hover:text-text-primary"
                >
                  {showKey ? "隐藏" : "显示"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 语言设定 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">
              识别语言代码 (Language Code)
            </label>
            <input
              type="text"
              value={form.asr_language || "zh"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  asr_language: e.target.value || "zh",
                }))
              }
              placeholder="zh"
              className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
