import { useState } from "react";
import type { ConfigSnapshot } from "@dramaxis/ipc";
import { Card } from "@dramaxis/ui";
import { MOSSLAND_PRESET_VOICES, type TtsMeta } from "./ttsOptions";

interface TtsEngineConfigCardProps {
  currentTts: TtsMeta;
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
  onPreview: () => void;
  isPlayingPreview: boolean;
}

export function TtsEngineConfigCard({
  currentTts,
  form,
  setForm,
  onPreview,
  isPlayingPreview,
}: TtsEngineConfigCardProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="text-sm font-bold text-text-primary">
            {currentTts.label} 配音引擎参数
          </div>
          <div className="text-[11px] text-text-secondary">
            {currentTts.hint}
          </div>
        </div>
        <button
          type="button"
          disabled={isPlayingPreview}
          onClick={onPreview}
          className="rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-text-primary transition hover:border-gold active:scale-95 disabled:opacity-50"
        >
          {isPlayingPreview ? "⌛ 试听中..." : "▶ 试听合成"}
        </button>
      </div>

      {currentTts.needApiKey && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary">
            API Key 凭据
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={form.tts_api_key || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tts_api_key: e.target.value || null,
                }))
              }
              placeholder={`请输入 ${currentTts.label} API Key`}
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
      )}

      {/* 默认声线与模型选择 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary">
            默认角色声线 (Voice / Speaker)
          </label>
          <input
            type="text"
            value={form.tts_voice || currentTts.defaultVoice || "zh-CN-YunxiNeural"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tts_voice: e.target.value || null,
              }))
            }
            placeholder={currentTts.defaultVoice || "如 moss-narrator-male / zh-CN-YunxiNeural"}
            className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
          />
          {form.tts_provider === "mossland" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-text-muted">推荐解说声线:</span>
              {MOSSLAND_PRESET_VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tts_voice: v.id }))}
                  className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-muted hover:bg-gold/20 hover:text-gold text-text-secondary border border-border transition-colors"
                >
                  {v.label} ({v.id})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary">
            TTS 模型名称 (Model)
          </label>
          <input
            type="text"
            value={form.tts_model || currentTts.defaultModel || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tts_model: e.target.value || null,
              }))
            }
            placeholder={currentTts.defaultModel || "如 moss-tts-v1 / tts-1 / tts-1-hd"}
            className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      {/* 服务 Base URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-text-secondary">
          服务 Base URL
        </label>
        <input
          type="text"
          value={form.tts_base_url || currentTts.defaultBaseUrl || ""}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              tts_base_url: e.target.value || null,
            }))
          }
          placeholder={currentTts.defaultBaseUrl || "官方默认地址"}
          className="w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-gold focus:outline-none"
        />
      </div>
    </Card>
  );
}
