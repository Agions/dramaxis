/**
 * dramaxis v1.1.0 · VoiceStudioPanel · 48kHz 配音与零样本人声克隆工坊
 */

import { memo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { voiceIpc } from "@dramaxis/ipc";

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
  const [selectedVoice, setSelectedVoice] = useState("zh-CN-YunxiNeural");
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleSelectRefAudio = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "参考音频 (Audio)",
            extensions: ["wav", "mp3", "flac", "m4a"],
          },
        ],
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setRefAudioPath(path ?? null);
        toast.success(`已载入参考音频: ${String(path).split(/[/\\]/).pop()}`);
      }
    } catch {
      toast.error("选择音频失败");
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

    try {
      const res = await voiceIpc.preview({
        provider: voiceEngine,
        voice: selectedVoice,
        ratePercent: 0,
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

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          TTS 引擎
        </label>
        <div className="flex flex-col gap-1.5">
          {[
            {
              id: "edge",
              label: "Edge-TTS",
              sub: "微软官方 · 48kHz 免密钥",
              icon: "🎙️",
            },
            {
              id: "gpt-sovits",
              label: "GPT-SoVITS",
              sub: "零样本克隆 · 本地端点",
              icon: "🧬",
            },
            {
              id: "mimo",
              label: "MiniMax / MiMo",
              sub: "speech-02-hd · 商业旗舰",
              icon: "📱",
            },
            {
              id: "open-ai",
              label: "OpenAI TTS",
              sub: "影视原声 · tts-1-hd",
              icon: "💎",
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
                  onChange={() => onVoiceEngineChange(e.id)}
                  className="accent-gold"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{e.label}</span>
                  <span className="text-[9px] opacity-70">{e.sub}</span>
                </div>
              </div>
              <span className="text-base">{e.icon}</span>
            </label>
          ))}
        </div>
      </div>

      {voiceEngine === "gpt-sovits" && (
        <div className="rounded-xl border border-gold/40 bg-gold-muted p-3 space-y-2">
          <span className="text-xs font-bold text-gold">
            🧬 5 秒参考音频零样本克隆
          </span>
          <p className="text-[10px] text-text-secondary">
            {refAudioPath
              ? `已选: ${refAudioPath.split(/[/\\]/).pop()}`
              : "导入一段 5~10 秒的主角无杂音干声音频"}
          </p>
          <button
            type="button"
            onClick={handleSelectRefAudio}
            className="w-full rounded-lg border border-gold bg-bg py-1.5 text-xs text-gold hover:bg-gold hover:text-zinc-950 transition-colors font-bold"
          >
            {refAudioPath
              ? "更换参考音频文件"
              : "选择参考音频文件 (.wav / .mp3)"}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          说话人音色预设
        </label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-gold"
        >
          <option value="zh-CN-YunxiNeural">
            云希 · 影视悬疑短剧解说 (经典沉浸)
          </option>
          <option value="zh-CN-YunjianNeural">
            云健 · 影视解说吐槽 (幽默快节奏)
          </option>
          <option value="zh-CN-XiaoxiaoNeural">
            晓晓 · 第一人称女主独白 (深情细腻)
          </option>
          <option value="zh-CN-YunyangNeural">
            云扬 · 悬疑重案深度解析 (沉稳庄重)
          </option>
        </select>
      </div>

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
