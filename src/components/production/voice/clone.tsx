/**
 * dramaxis v1.1.0 · 零样本克隆参考音频卡片 (CloneReferenceCard)
 *
 * 核心功能:
 * - 5~10 秒干声参考音频选取与路径展示
 * - 本地音频格式校验与更新
 */

import { memo } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

interface CloneReferenceCardProps {
  refAudioPath: string | null;
  onRefAudioPathChange: (path: string | null) => void;
}

export const CloneReferenceCard = memo(function CloneReferenceCard({
  refAudioPath,
  onRefAudioPathChange,
}: CloneReferenceCardProps) {
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
        onRefAudioPathChange(path ?? null);
        toast.success(`已载入参考音频: ${String(path).split(/[/\\]/).pop()}`);
      }
    } catch {
      toast.error("选择音频失败");
    }
  };

  return (
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
  );
});
