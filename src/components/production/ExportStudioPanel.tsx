/**
 * splicr v1.0.1 · ExportStudioPanel · 剪映原生工程草稿与多平台交付工坊
 *
 * 全真实数据导出与硬件加速渲染中枢:
 * - 剪映原生 PC 工程草稿 (.draft) 全真实材料与多轨组装导出
 * - 多平台直接渲染 MP4 视频 (抖音/B站/小红书/快手)
 * - 实时 FFmpeg 压制进度条 (export://progress)
 * - 高完播率防重矩阵 (动态微缩放 + 9:16 环境高斯模糊底衬)
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import {
  exportIpc,
  type ProjectRecord,
  type RenderProgressPayload,
} from "@dramaxis/ipc";
import { useTauriEvent } from "@hooks/useTauriEvent";

interface ExportStudioPanelProps {
  currentProject: ProjectRecord | null;
  antiDupZoom: number;
  onAntiDupZoomChange: (val: number) => void;
  enableAmbientBlur: boolean;
  onEnableAmbientBlurChange: (val: boolean) => void;
  voiceAudioPath?: string | null;
  voiceDuration?: number;
  subtitles?: { id: string; text: string; start: number; duration: number }[];
  sceneCuts?: { id: number; time: string; tag: string; emotion: string }[];
}

export const ExportStudioPanel = memo(function ExportStudioPanel({
  currentProject,
  antiDupZoom,
  onAntiDupZoomChange,
  enableAmbientBlur,
  onEnableAmbientBlurChange,
  voiceAudioPath,
  voiceDuration,
  subtitles = [],
  sceneCuts = [],
}: ExportStudioPanelProps) {
  const [isExportingDraft, setIsExportingDraft] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderPhase, setRenderPhase] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // 监听后端 FFmpeg 实时压制进度
  useTauriEvent<RenderProgressPayload>("export://progress", (e) => {
    if (e.payload) {
      setRenderProgress(Math.round(e.payload.percent));
      if (e.payload.phase === "completed") {
        setRenderPhase("压制合成已完成");
      } else {
        setRenderPhase(`正在渲染 (${e.payload.timeSeconds.toFixed(1)}s)`);
      }
    }
  });

  const handleExportJianying = async () => {
    setIsExportingDraft(true);
    try {
      const mediaFile = currentProject?.project?.media_files?.[0]?.path;
      // 提取场景切点秒数
      const cutPoints = sceneCuts.map((c) => {
        const parts = c.time.split(" - ").map((t) => {
          const [m, s] = t.split(":").map(Number);
          return (m || 0) * 60 + (s || 0);
        });
        return parts[1] ?? parts[0] ?? 0;
      });

      const draftResult = await exportIpc.capcutDraft({
        projectName: currentProject?.project?.name ?? "dramaxis_project",
        videoPath: mediaFile ?? null,
        videoDurationSeconds:
          currentProject?.project?.media_files?.[0]?.duration_seconds ?? 60,
        sceneCuts: cutPoints,
        voicePath: voiceAudioPath ?? null,
        voiceDurationSeconds:
          voiceDuration && voiceDuration > 0 ? voiceDuration : null,
        subtitles: subtitles.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.start + s.duration,
        })),
        antiDupZoom,
        enableAmbientBlur,
        targetDir: null,
      });

      if (draftResult.isJianyingInstalled) {
        toast.success("剪映草稿工程已直接同步至剪映首页！", {
          description: `草稿已写入剪映草稿库: ${draftResult.draftFolder}，打开剪映 PC 端即可直接二次微调`,
        });
      } else {
        toast.success("剪映原生工程草稿导出成功！", {
          description: `草稿已保存在: ${draftResult.draftFolder}`,
        });
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("剪映原生工程草稿导出失败", {
        description: err?.message ?? "请检查系统权限或重试",
      });
    } finally {
      setIsExportingDraft(false);
    }
  };

  const handleRenderVideo = async (presetName: string) => {
    const mediaFile = currentProject?.project?.media_files?.[0]?.path;
    if (!mediaFile) {
      toast.error("未检测到主摄视频素材，请先导入素材");
      return;
    }

    setIsRendering(true);
    setActivePreset(presetName);
    setRenderProgress(0);
    setRenderPhase("启动 FFmpeg 硬件加速压制引擎...");

    try {
      const res = await exportIpc.renderVideo({
        videoPath: mediaFile,
        voicePath: voiceAudioPath ?? null,
        subtitles: subtitles.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.start + s.duration,
        })),
        platformPreset: presetName,
        antiDupZoom,
        enableAmbientBlur,
        outputPath: null,
      });

      toast.success(`${presetName} 格式压制渲染成功！`, {
        description: `成片已保存至: ${res.outputPath} (文件大小: ${(res.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("视频压制渲染失败", {
        description: err?.message ?? "请检查 FFmpeg 与素材参数",
      });
    } finally {
      setIsRendering(false);
      setActivePreset(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 剪映原生草稿一键导出 (首选) */}
      <div className="rounded-2xl border border-gold bg-gold-muted p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <div>
              <div className="text-xs font-black text-gold">
                剪映 PC 原生工程草稿 (.draft)
              </div>
              <div className="text-[9px] text-text-secondary">
                首选推荐 · 100% 保留多轨、字幕与音效
              </div>
            </div>
          </div>
          <span className="rounded bg-surface border border-border px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 font-bold">
            无损二次微调
          </span>
        </div>

        <button
          type="button"
          disabled={isExportingDraft}
          onClick={handleExportJianying}
          className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-black text-zinc-950 shadow-[0_0_20px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>🚀</span>
          <span>
            {isExportingDraft ? "正在导出多轨草稿..." : "一键导出至剪映草稿库"}
          </span>
        </button>
      </div>

      {/* 防重矩阵参数 */}
      <div className="rounded-xl border border-border bg-bg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-primary">
            高完播率防重矩阵 (Anti-Dup)
          </span>
          <span className="text-[9px] font-mono text-gold">AI 自动应用</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-text-secondary">
              画面动态微缩放 (1.00x ~ 1.08x)
            </span>
            <span className="font-mono text-gold">
              {antiDupZoom.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={1.0}
            max={1.08}
            step={0.01}
            value={antiDupZoom}
            onChange={(e) => onAntiDupZoomChange(parseFloat(e.target.value))}
            className="w-full accent-gold"
          />
        </div>

        <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer">
          <span>9:16 竖屏高斯模糊环境底衬</span>
          <input
            type="checkbox"
            checked={enableAmbientBlur}
            onChange={(e) => onEnableAmbientBlurChange(e.target.checked)}
            className="accent-gold"
          />
        </label>
      </div>

      {/* 多平台直导 */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-primary">
            直接渲染成片 (MP4)
          </label>
          <span className="text-[9px] font-mono text-emerald-400 font-bold">
            FFmpeg 硬件加速
          </span>
        </div>

        {/* 渲染进度条展示 */}
        {isRendering && (
          <div className="rounded-lg border border-gold/30 bg-bg p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-gold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
                <span>{renderPhase || "压制中..."}</span>
              </span>
              <span className="font-mono font-bold text-gold">
                {renderProgress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-150"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "douyin", label: "抖音 / TikTok (9:16)" },
            { id: "bilibili", label: "B站 / YouTube (16:9)" },
            { id: "xiaohongshu", label: "小红书 (9:16)" },
            { id: "kuaishou", label: "快手 (9:16)" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={isRendering}
              onClick={() => void handleRenderVideo(p.label)}
              className={`rounded-lg border py-2 text-[11px] font-semibold transition-all ${
                activePreset === p.label
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border bg-bg text-text-secondary hover:border-gold hover:text-gold"
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              {activePreset === p.label ? "正在压制..." : p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
