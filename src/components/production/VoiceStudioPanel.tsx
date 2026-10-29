/**
 * dramaxis v1.1.0 · VoiceStudioPanel · 48kHz 配音与零样本人声克隆工坊
 *
 * 核心功能:
 * - 6 大主流 TTS 引擎切换 (Edge-TTS / Mossland / OpenAI / MiniMax / GPT-SoVITS / Custom)
 * - 引擎专属合法音色字典 (VOICE_PRESETS)，彻底杜绝跨引擎音色错配崩溃
 * - 解说语速微调 (-10% ~ +30%)
 * - 聚合 CloneReferenceCard 零样本人声克隆
 * - VoiceArtistAgent 48kHz 沉浸配音直通 A1 轨道
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import { voiceIpc } from "@dramaxis/ipc";
import { CloneReferenceCard } from "./voice/CloneReferenceCard";

export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICE_PRESETS: Record<string, VoiceOption[]> = {
  edge: [
    { id: "zh-CN-YunxiNeural", label: "云希 · 影视悬疑短剧解说 (经典沉浸)" },
    { id: "zh-CN-YunjianNeural", label: "云健 · 影视解说吐槽 (幽默快节奏)" },
    { id: "zh-CN-XiaoxiaoNeural", label: "晓晓 · 第一人称女主独白 (深情细腻)" },
    { id: "zh-CN-YunyangNeural", label: "云扬 · 悬疑重案深度解析 (沉稳庄重)" },
  ],
  mossland: [
    {
      id: "moss-narrator-male",
      label: "摩斯 · 电影沉浸解说男声 (moss-narrator-male)",
    },
    { id: "moss-suspense-01", label: "摩斯 · 悬疑反转声线 (moss-suspense-01)" },
    {
      id: "moss-narrator-female",
      label: "摩斯 · 情感叙事女声 (moss-narrator-female)",
    },
  ],
  "open-ai": [
    { id: "alloy", label: "Alloy · 自然均衡影视男声" },
    { id: "onyx", label: "Onyx · 浑厚低沉 (悬疑/纪录片推荐)" },
    { id: "echo", label: "Echo · 沉稳内敛男声" },
    { id: "fable", label: "Fable · 英式叙事故事感" },
    { id: "nova", label: "Nova · 活力灵动女声" },
    { id: "shimmer", label: "Shimmer · 温柔细腻女声" },
  ],
  mimo: [
    { id: "female-shaonv", label: "少女解说 (female-shaonv)" },
    { id: "male-qn-qingse", label: "青涩男声 (male-qn-qingse)" },
  ],
  "gpt-sovits": [
    { id: "clone-reference", label: "零样本克隆声线 (基于参考音频)" },
  ],
  custom: [
    { id: "custom_input", label: "⚙️ 自定义 Voice ID (手动输入)" },
  ],
};

export function getDefaultVoiceForEngine(engine: string): string {
  const presets = VOICE_PRESETS[engine];
  return presets?.[0]?.id ?? "zh-CN-YunxiNeural";
}

interface VoiceStudioPanelProps {
  voiceEngine: string;
  onVoiceEngineChange: (val: string) => void;
  scriptText: string;
  onAudioGenerated?: (audioPath: string) => void;
}

export const VoiceStudioPanel = memo(function VoiceStudioPanel({
  voiceEngine,
  onVoiceEngineChange,
  scriptText,
  onAudioGenerated,
}: VoiceStudioPanelProps) {
  const [refAudioPath, setRefAudioPath] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(
    getDefaultVoiceForEngine(voiceEngine),
  );
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [ratePercent, setRatePercent] = useState(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // 跨引擎平滑切换，自动修正为当前引擎的合法音色
  const handleEngineSelect = (newEngine: string) => {
    onVoiceEngineChange(newEngine);
    const validPresets = VOICE_PRESETS[newEngine] ?? [];
    const isCurrentValid =
      selectedVoice === "custom_input" ||
      validPresets.some((p) => p.id === selectedVoice);

    if (!isCurrentValid) {
      setSelectedVoice(getDefaultVoiceForEngine(newEngine));
    }
  };

  const handleSynthesizeVoice = async () => {
    const text = scriptText.trim();
    if (!text) {
      toast.warning("请先生成或输入解说剧本文案");
      return;
    }

    setIsSynthesizing(true);
    const toastId = toast.loading(
      "VoiceArtistAgent: 正在合成 48kHz 沉浸人声配音...",
    );

    const voiceToUse =
      selectedVoice === "custom_input"
        ? customVoiceId.trim() || getDefaultVoiceForEngine(voiceEngine)
        : selectedVoice;

    try {
      const res = await voiceIpc.preview({
        provider: voiceEngine,
        voice: voiceToUse,
        ratePercent,
        text,
        apiKey: null,
        baseUrl: null,
        model: null,
        refAudioPath,
        promptText: null,
      });

      onAudioGenerated?.(res.filePath);
      toast.success(
        `✓ VoiceArtistAgent: 配音生成完成 (${res.bytesWritten} 字节)，已吸附至 A1 轨道`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(`TTS 配音合成失败: ${String(e)}`, { id: toastId });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const currentPresets: VoiceOption[] =
    VOICE_PRESETS[voiceEngine] ?? VOICE_PRESETS.edge ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* 1. TTS 引擎选型 */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          TTS 引擎
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            {
              id: "edge",
              label: "Edge-TTS",
              sub: "微软官方 · 48kHz 免密钥",
              icon: "🎙️",
            },
            {
              id: "mossland",
              label: "Mossland 摩斯配音",
              sub: "mossland.studio · 影视专属情绪声线",
              icon: "🎭",
            },
            {
              id: "open-ai",
              label: "OpenAI TTS",
              sub: "影视原声 · tts-1-hd / alloy",
              icon: "💎",
            },
            {
              id: "mimo",
              label: "MiniMax / MiMo",
              sub: "speech-02-hd · 商业旗舰",
              icon: "📱",
            },
            {
              id: "gpt-sovits",
              label: "GPT-SoVITS",
              sub: "零样本克隆 · 本地端点",
              icon: "🧬",
            },
            {
              id: "custom",
              label: "自定义 OpenAI TTS",
              sub: "OpenAI /v1/audio/speech 兼容 API",
              icon: "⚙️",
            },
          ].map((e) => (
            <label
              key={e.id}
              className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                voiceEngine === e.id
                  ? "border-gold bg-gold-muted text-gold shadow-sm font-bold"
                  : "border-border bg-bg text-text-secondary hover:text-text-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="voiceEngine"
                  value={e.id}
                  checked={voiceEngine === e.id}
                  onChange={() => handleEngineSelect(e.id)}
                  className="accent-gold"
                />
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold truncate">{e.label}</span>
                  <span className="text-[9px] opacity-70 truncate">
                    {e.sub}
                  </span>
                </div>
              </div>
              <span className="text-base shrink-0">{e.icon}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 2. GPT-SoVITS 参考音频插槽 */}
      {voiceEngine === "gpt-sovits" && (
        <CloneReferenceCard
          refAudioPath={refAudioPath}
          onRefAudioPathChange={setRefAudioPath}
        />
      )}

      {/* 3. Mossland 说明 */}
      {voiceEngine === "mossland" && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-2.5 text-[11px] text-text-secondary space-y-1">
          <div className="font-semibold text-gold">🎭 Mossland 摩斯电影配音</div>
          <div>
            在「设置」中配置 mossland.studio API Key 即可全速调用。支持直接输入自定义音色 ID。
          </div>
        </div>
      )}

      {/* 4. 说话人音色预设 */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          说话人音色预设
        </label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-gold"
        >
          {currentPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom_input">⚙️ 自定义 Voice ID (手动输入)...</option>
        </select>

        {selectedVoice === "custom_input" && (
          <div className="pt-1.5 space-y-1">
            <input
              type="text"
              value={customVoiceId}
              onChange={(e) => setCustomVoiceId(e.target.value)}
              placeholder="请输入自定义音色 ID (如 moss-narrator-male 或克隆音色 ID)"
              className="w-full rounded-xl border border-gold bg-bg px-3 py-2 text-xs font-mono text-text-primary outline-none focus:ring-1 focus:ring-gold"
            />
            <p className="text-[10px] text-text-muted">
              提示：可直接填入 Mossland 或 OpenAI 兼容平台上的任意 Voice ID / Speaker 标识
            </p>
          </div>
        )}
      </div>

      {/* 5. 解说语速微调 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-text-secondary">
            解说语速微调
          </label>
          <span className="font-mono text-[11px] text-gold font-bold">
            {ratePercent > 0 ? `+${ratePercent}%` : `${ratePercent}%`}
            {ratePercent === 0
              ? " (原速 1.0x)"
              : ratePercent > 0
                ? " (快节奏推荐)"
                : ""}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { rate: -10, label: "0.9x 沉缓" },
            { rate: 0, label: "1.0x 标准" },
            { rate: 15, label: "1.15x 紧凑" },
            { rate: 25, label: "1.25x 快反" },
          ].map((item) => (
            <button
              key={item.rate}
              type="button"
              onClick={() => setRatePercent(item.rate)}
              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                ratePercent === item.rate
                  ? "border-gold bg-gold-muted text-gold font-bold shadow-xs"
                  : "border-border bg-bg text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. 生成配音按钮 */}
      <button
        type="button"
        disabled={isSynthesizing}
        onClick={handleSynthesizeVoice}
        className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
      >
        {isSynthesizing ? "⏳ 正在合成配音..." : "🎙️ 生成 48kHz 高清解说配音"}
      </button>
    </div>
  );
});
