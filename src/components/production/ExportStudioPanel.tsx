/**
 * dramaxis v1.1.0 · ExportStudioPanel · 剪映原生工程草稿与多平台交付工坊
 *
 * 全真实数据导出与硬件加速渲染中枢:
 * - 剪映原生 PC 工程草稿 (.draft) 全真实材料与多轨组装导出
 * - 多平台直接渲染 MP4 视频 (抖音/B站/小红书/快手)
 * - 实时 FFmpeg 压制进度条 (export://progress)
 * - 高完播率防重矩阵 (动态微缩放 + 9:16 环境高斯模糊底衬)
 */

import { memo, useState, useCallback } from "react";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  exportIpc,
  type ProjectRecord,
  type RenderProgressPayload,
  type DedupIntensity,
  type DedupOptions,
  type FissionProgressPayload,
  type CapcutDraftResult,
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
  const [subtitleStyle, setSubtitleStyle] = useState<
    "cinema_amber" | "yellow_black" | "retro_red" | "minimal_white"
  >("cinema_amber");
  const [enableAudioDucking, setEnableAudioDucking] = useState(true);
  const [ambientPath, setAmbientPath] = useState<string | null>(null);
  const [ambientLabel, setAmbientLabel] = useState("未挂载");
  const [ambientVolume, setAmbientVolume] = useState(0.35);
  const [bgmPath, setBgmPath] = useState<string | null>(null);
  const [bgmLabel, setBgmLabel] = useState("未挂载");
  const [bgmVolume, setBgmVolume] = useState(0.6);
  const [bgmDuckingLevel, setBgmDuckingLevel] = useState(0.18);

  // 8 维消重矩阵状态
  const [dedupIntensity, setDedupIntensity] = useState<DedupIntensity>("standard");
  const [enableSpeed, setEnableSpeed] = useState(true);
  const [speedRate, setSpeedRate] = useState(1.02);
  const [enableMirror, setEnableMirror] = useState(false);
  const [enableNoise, setEnableNoise] = useState(true);
  const [noiseStrength, setNoiseStrength] = useState(0.02);
  const [enableFpsDrift, setEnableFpsDrift] = useState(true);
  const [enablePitchShift, setEnablePitchShift] = useState(true);
  const [pitchShiftRate, setPitchShiftRate] = useState(1.015);
  const [enableBgmReverb, setEnableBgmReverb] = useState(true);
  const [enableMetadataScrub, setEnableMetadataScrub] = useState(true);
  const [showAdvancedDedup, setShowAdvancedDedup] = useState(false);

  // 批量裂变状态
  const [isFissioning, setIsFissioning] = useState(false);
  const [fissionCount, setFissionCount] = useState(3);
  const [fissionProgress, setFissionProgress] = useState(0);
  const [fissionMessage, setFissionMessage] = useState("");

  // 交付产物与系统交互状态
  const [exportedDraft, setExportedDraft] =
    useState<CapcutDraftResult | null>(null);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(
    null,
  );

  const handleOpenDraftFolder = async () => {
    if (!exportedDraft) return;
    try {
      await exportIpc.openFolder(exportedDraft.draftFolder);
      toast.success("已在文件资源管理器中定位草稿文件夹");
    } catch (e: any) {
      toast.error(`打开草稿目录失败: ${e?.message || String(e)}`);
    }
  };

  const handleLaunchJianying = async () => {
    try {
      await exportIpc.launchJianying();
      toast.success("已尝试唤起剪映 PC 端");
    } catch (e: any) {
      toast.error(`唤起剪映失败: ${e?.message || String(e)}`);
    }
  };

  const handleOpenVideoFolder = async () => {
    if (!renderedVideoPath) return;
    try {
      await exportIpc.openFolder(renderedVideoPath);
      toast.success("已在文件资源管理器中定位成片文件");
    } catch (e: any) {
      toast.error(`定位成片文件失败: ${e?.message || String(e)}`);
    }
  };

  const handleApplyPreset = useCallback((preset: DedupIntensity) => {
    setDedupIntensity(preset);
    if (preset === "mild") {
      onAntiDupZoomChange(1.02);
      setEnableSpeed(true);
      setSpeedRate(1.01);
      setEnableMirror(false);
      setEnableNoise(true);
      setNoiseStrength(0.01);
      setEnableFpsDrift(false);
      setEnablePitchShift(false);
      setPitchShiftRate(1.0);
      setEnableBgmReverb(false);
      setEnableMetadataScrub(true);
      toast.info("已切换至【轻度扰动】防重模式");
    } else if (preset === "standard") {
      onAntiDupZoomChange(1.04);
      setEnableSpeed(true);
      setSpeedRate(1.02);
      setEnableMirror(false);
      setEnableNoise(true);
      setNoiseStrength(0.02);
      setEnableFpsDrift(true);
      setEnablePitchShift(true);
      setPitchShiftRate(1.015);
      setEnableBgmReverb(true);
      setEnableMetadataScrub(true);
      toast.info("已切换至【工业标准】防重模式 (推荐)");
    } else if (preset === "aggressive") {
      onAntiDupZoomChange(1.06);
      setEnableSpeed(true);
      setSpeedRate(1.035);
      setEnableMirror(true);
      setEnableNoise(true);
      setNoiseStrength(0.035);
      setEnableFpsDrift(true);
      setEnablePitchShift(true);
      setPitchShiftRate(1.025);
      setEnableBgmReverb(true);
      setEnableMetadataScrub(true);
      toast.info("已切换至【强力裂变】高频混淆防重模式");
    }
  }, [onAntiDupZoomChange]);

  const handleSelectAmbientAudio = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "环境音效 (Audio)",
            extensions: ["wav", "mp3", "flac", "m4a"],
          },
        ],
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setAmbientPath(path ?? null);
        const fileName = String(path).split(/[/\\]/).pop() ?? "自定义音效";
        setAmbientLabel(fileName);
        toast.success(`已载入 A2 环境音效轨: ${fileName}`);
      }
    } catch {
      toast.error("选择环境音效失败");
    }
  };

  const handleSelectBgmAudio = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "背景配乐 (BGM)",
            extensions: ["wav", "mp3", "flac", "m4a"],
          },
        ],
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setBgmPath(path ?? null);
        const fileName = String(path).split(/[/\\]/).pop() ?? "自定义配乐";
        setBgmLabel(fileName);
        toast.success(`已载入 A3 背景配乐轨: ${fileName}`);
      }
    } catch {
      toast.error("选择背景配乐失败");
    }
  };

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

  // 监听后端批量裂变进度
  useTauriEvent<FissionProgressPayload>("export://fission_progress", (e) => {
    if (e.payload) {
      setFissionProgress(Math.round(e.payload.percent));
      setFissionMessage(e.payload.message);
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
        ambientPath: ambientPath ?? null,
        ambientVolume,
        bgmPath: bgmPath ?? null,
        bgmDurationSeconds: null,
        bgmVolume,
        bgmDuckingLevel,
        enableAudioDucking,
        subtitleStyle,
      });

      setExportedDraft(draftResult);
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

    const currentDedup: DedupOptions = {
      intensity: dedupIntensity,
      enableZoom: (antiDupZoom - 1.0) > 0.001,
      zoomRate: antiDupZoom,
      enableSpeed,
      speedRate,
      enableMirror,
      enableNoise,
      noiseStrength,
      enableFpsDrift,
      fpsDriftVal: 30.05,
      enablePitchShift,
      pitchShiftRate,
      enableBgmReverb,
      reverbDecay: 0.3,
      enableMetadataScrub,
    };

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
        dedup: currentDedup,
        outputPath: null,
      });

      setRenderedVideoPath(res.outputPath);
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

  const handleBatchFission = async () => {
    const mediaFile = currentProject?.project?.media_files?.[0]?.path;
    if (!mediaFile) {
      toast.error("未检测到主摄视频素材，请先导入素材");
      return;
    }

    setIsFissioning(true);
    setFissionProgress(0);
    setFissionMessage(`启动 ${fissionCount} 份多维裂变流水线...`);

    const currentDedup: DedupOptions = {
      intensity: dedupIntensity,
      enableZoom: (antiDupZoom - 1.0) > 0.001,
      zoomRate: antiDupZoom,
      enableSpeed,
      speedRate,
      enableMirror,
      enableNoise,
      noiseStrength,
      enableFpsDrift,
      fpsDriftVal: 30.05,
      enablePitchShift,
      pitchShiftRate,
      enableBgmReverb,
      reverbDecay: 0.3,
      enableMetadataScrub,
    };

    try {
      const res = await exportIpc.batchFission({
        videoPath: mediaFile,
        voicePath: voiceAudioPath ?? null,
        subtitles: subtitles.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.start + s.duration,
        })),
        platformPreset: "抖音 / TikTok (9:16)",
        baseDedup: currentDedup,
        count: fissionCount,
        outputDir: null,
      });

      toast.success(`成功并发裂变 ${res.variants.length} 份独立短视频！`, {
        description: `各版本指纹互斥防重，可直接分发各平台多矩阵账号`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("批量裂变失败", {
        description: err?.message ?? "请检查 FFmpeg 与素材参数",
      });
    } finally {
      setIsFissioning(false);
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

        {/* 5 轨就绪状态展示 */}
        <div className="grid grid-cols-5 gap-1 text-[9px] font-mono text-center">
          <div
            className={`rounded border p-1 font-bold ${
              currentProject?.project?.media_files?.length
                ? "bg-gold/15 border-gold text-gold"
                : "bg-surface-elevated/70 border-border text-text-muted"
            }`}
          >
            {currentProject?.project?.media_files?.length
              ? "✓ V1 画面"
              : "V1 画面"}
          </div>
          <div
            className={`rounded border p-1 font-bold ${
              voiceAudioPath
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                : "bg-surface-elevated/70 border-border text-text-muted"
            }`}
          >
            {voiceAudioPath ? "✓ A1 独白" : "A1 独白"}
          </div>
          <div
            className={`rounded border p-1 font-bold ${
              ambientPath
                ? "bg-cyan-500/15 border-cyan-500 text-cyan-400"
                : "bg-surface-elevated/70 border-border text-text-muted"
            }`}
          >
            {ambientPath ? "✓ A2 环境" : "A2 环境"}
          </div>
          <div
            className={`rounded border p-1 font-bold ${
              bgmPath
                ? "bg-purple-500/15 border-purple-500 text-purple-400"
                : "bg-surface-elevated/70 border-border text-text-muted"
            }`}
          >
            {bgmPath ? "✓ A3 配乐" : "A3 配乐"}
          </div>
          <div
            className={`rounded border p-1 font-bold ${
              subtitles.length > 0
                ? "bg-amber-500/15 border-amber-500 text-amber-400"
                : "bg-surface-elevated/70 border-border text-text-muted"
            }`}
          >
            {subtitles.length > 0 ? "✓ S1 花字" : "S1 花字"}
          </div>
        </div>

        {/* A2/A3 声学音轨与自动闪避控制 */}
        <div className="rounded-xl border border-border/70 bg-surface/50 p-2.5 space-y-2">
          {/* A2 环境音效轨 */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary font-medium flex items-center gap-1">
              <span>🌊</span>
              <span>A2 环境音效轨:</span>
              <span className="font-mono text-cyan-400 font-bold truncate max-w-[130px]">
                {ambientLabel}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSelectAmbientAudio}
              className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold text-[10px] border border-cyan-500/20 transition-colors"
            >
              {ambientPath ? "更换音效" : "+ 载入音效"}
            </button>
          </div>
          {ambientPath && (
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>音量:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="font-mono text-cyan-400 w-8 text-right">
                {Math.round(ambientVolume * 100)}%
              </span>
            </div>
          )}

          {/* A3 背景配乐轨 */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary font-medium flex items-center gap-1">
              <span>🎵</span>
              <span>A3 背景配乐轨:</span>
              <span className="font-mono text-purple-400 font-bold truncate max-w-[130px]">
                {bgmLabel}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSelectBgmAudio}
              className="px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold text-[10px] border border-purple-500/20 transition-colors"
            >
              {bgmPath ? "更换配乐" : "+ 载入配乐"}
            </button>
          </div>
          {bgmPath && (
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>音量:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bgmVolume}
                onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                className="w-full accent-purple-400"
              />
              <span className="font-mono text-purple-400 w-8 text-right">
                {Math.round(bgmVolume * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 花字风格预设 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">爆款字幕花字风格</span>
            <span className="text-[9px] font-mono text-gold font-bold">
              {subtitleStyle === "cinema_amber"
                ? "琥珀金 (影院调光)"
                : subtitleStyle === "yellow_black"
                ? "爆款黄黑边"
                : subtitleStyle === "retro_red"
                ? "悬疑醒目红"
                : "极简纯白"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: "cinema_amber", label: "琥珀金" },
              { id: "yellow_black", label: "黄黑边" },
              { id: "retro_red", label: "悬疑红" },
              { id: "minimal_white", label: "极简白" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setSubtitleStyle(
                    s.id as
                      | "cinema_amber"
                      | "yellow_black"
                      | "retro_red"
                      | "minimal_white",
                  )
                }
                className={`rounded py-1 text-[10px] font-bold transition-all border ${
                  subtitleStyle === s.id
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-border bg-bg text-text-secondary hover:border-gold/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 智能闪避开关与衰减深度 */}
        <div className="space-y-1">
          <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer">
            <span>BGM 智能响度自动闪避 (独白发声时动态衰减)</span>
            <input
              type="checkbox"
              checked={enableAudioDucking}
              onChange={(e) => setEnableAudioDucking(e.target.checked)}
              className="accent-gold"
            />
          </label>
          {enableAudioDucking && (
            <div className="flex items-center justify-between text-[10px] text-text-muted gap-2 pl-1">
              <span>衰减深度:</span>
              <input
                type="range"
                min={0.08}
                max={0.35}
                step={0.01}
                value={bgmDuckingLevel}
                onChange={(e) => setBgmDuckingLevel(parseFloat(e.target.value))}
                className="w-full accent-gold"
              />
              <span className="font-mono text-gold w-14 text-right">
                {Math.round(20 * Math.log10(bgmDuckingLevel))} dB
              </span>
            </div>
          )}
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

        {/* 导出成功后的系统联动操作 */}
        {exportedDraft && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span>✓</span>
                <span>草稿就绪: {exportedDraft.draftId}</span>
              </span>
              <span className="font-mono opacity-80">{exportedDraft.totalDurationSeconds.toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleOpenDraftFolder}
                className="flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold text-text-primary hover:border-gold hover:text-gold transition-colors"
                title="在文件资源管理器中打开草稿工程文件夹"
              >
                <span>📂</span>
                <span>打开草稿目录</span>
              </button>
              <button
                type="button"
                onClick={handleLaunchJianying}
                className="flex items-center justify-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-bold text-gold hover:bg-gold/20 transition-colors"
                title="尝试唤起本机安装的剪映 PC 端"
              >
                <span>🚀</span>
                <span>启动剪映</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 8 维全频消重矩阵参数 */}
      <div className="rounded-xl border border-border bg-bg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary">
              高完播率防重矩阵 (Anti-Dup)
            </span>
            <span className="rounded bg-gold/15 px-1 py-0.2 text-[8px] font-mono text-gold font-bold">
              8 维混淆
            </span>
          </div>
          <span className="text-[9px] font-mono text-gold">AI 自动应用</span>
        </div>

        {/* 预设方案切换 */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: "mild" as const, label: "轻度扰动", desc: "画质优先" },
            { id: "standard" as const, label: "工业标准", desc: "推荐平衡" },
            { id: "aggressive" as const, label: "强力裂变", desc: "多号矩阵" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              className={`rounded border p-1 text-center transition-all ${
                dedupIntensity === preset.id
                  ? "border-gold bg-gold/15 text-gold font-bold"
                  : "border-border bg-surface text-text-secondary hover:border-gold/50"
              }`}
            >
              <div className="text-[10px]">{preset.label}</div>
              <div className="text-[8px] opacity-70">{preset.desc}</div>
            </button>
          ))}
        </div>

        {/* 1. 画面动态微缩放 */}
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
            aria-label="画面动态微缩放"
            min={1.0}
            max={1.08}
            step={0.01}
            value={antiDupZoom}
            onChange={(e) => onAntiDupZoomChange(parseFloat(e.target.value))}
            className="w-full accent-gold"
          />
        </div>

        {/* 环境底衬 */}
        <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer">
          <span>9:16 竖屏高斯模糊环境底衬</span>
          <input
            type="checkbox"
            checked={enableAmbientBlur}
            onChange={(e) => onEnableAmbientBlurChange(e.target.checked)}
            className="accent-gold"
          />
        </label>

        {/* 展开/收起 8 维高级消重算子 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvancedDedup(!showAdvancedDedup)}
            className="w-full flex items-center justify-between text-[10px] text-text-muted hover:text-gold transition-colors py-1"
          >
            <span>8 维音画混淆算子精细调节</span>
            <span>{showAdvancedDedup ? "收起 ▲" : "展开 ▼"}</span>
          </button>

          {showAdvancedDedup && (
            <div className="mt-2 space-y-2.5 rounded-lg border border-border/70 bg-surface/50 p-2 text-[10px]">
              {/* 2. 帧率微变速 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSpeed}
                      onChange={(e) => setEnableSpeed(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>帧率微变速</span>
                  </label>
                  <span className="font-mono text-gold">{speedRate.toFixed(3)}x</span>
                </div>
                {enableSpeed && (
                  <input
                    type="range"
                    min={1.005}
                    max={1.05}
                    step={0.005}
                    value={speedRate}
                    onChange={(e) => setSpeedRate(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 3. 智能镜像翻转 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>画面水平翻转 (Smart Mirror)</span>
                <input
                  type="checkbox"
                  checked={enableMirror}
                  onChange={(e) => setEnableMirror(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 4. 胶片噪点 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableNoise}
                      onChange={(e) => setEnableNoise(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>胶片颗粒高斯噪点</span>
                  </label>
                  <span className="font-mono text-gold">{Math.round(noiseStrength * 100)}%</span>
                </div>
                {enableNoise && (
                  <input
                    type="range"
                    min={0.01}
                    max={0.05}
                    step={0.005}
                    value={noiseStrength}
                    onChange={(e) => setNoiseStrength(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 5. 抽插帧与帧率漂移 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>抽插帧与帧率微漂移 (防帧哈希对碰)</span>
                <input
                  type="checkbox"
                  checked={enableFpsDrift}
                  onChange={(e) => setEnableFpsDrift(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 6. 音频微调音高 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePitchShift}
                      onChange={(e) => setEnablePitchShift(e.target.checked)}
                      className="accent-gold"
                    />
                    <span>人声音高微偏移 (防声纹对碰)</span>
                  </label>
                  <span className="font-mono text-gold">
                    {pitchShiftRate >= 1.0 ? `+${((pitchShiftRate - 1.0) * 100).toFixed(1)}%` : `${((pitchShiftRate - 1.0) * 100).toFixed(1)}%`}
                  </span>
                </div>
                {enablePitchShift && (
                  <input
                    type="range"
                    min={0.98}
                    max={1.03}
                    step={0.005}
                    value={pitchShiftRate}
                    onChange={(e) => setPitchShiftRate(parseFloat(e.target.value))}
                    className="w-full accent-gold"
                  />
                )}
              </div>

              {/* 7. BGM空间微混响 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>BGM 空间微混响滤波</span>
                <input
                  type="checkbox"
                  checked={enableBgmReverb}
                  onChange={(e) => setEnableBgmReverb(e.target.checked)}
                  className="accent-gold"
                />
              </label>

              {/* 8. 元数据随机擦除 */}
              <label className="flex items-center justify-between cursor-pointer">
                <span>擦除源文件 EXIF 并随机化签名</span>
                <input
                  type="checkbox"
                  checked={enableMetadataScrub}
                  onChange={(e) => setEnableMetadataScrub(e.target.checked)}
                  className="accent-gold"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 批量裂变任务池 */}
      <div className="rounded-xl border border-gold/40 bg-surface p-3 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚡</span>
            <span className="text-xs font-bold text-text-primary">
              一键批量裂变出片 (Batch Fission)
            </span>
          </div>
          <span className="text-[9px] font-mono text-gold font-bold">
            全自动互斥指纹
          </span>
        </div>
        <p className="text-[10px] text-text-muted leading-relaxed">
          基于当前工程自动生成多份音画特征互斥的成片，每份具备独特的微缩放、音高、变速与噪点指纹。
        </p>

        {isFissioning && (
          <div className="rounded-lg border border-gold/30 bg-bg p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-gold">{fissionMessage || "正在批量裂变..."}</span>
              <span className="font-mono font-bold text-gold">{fissionProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-amber transition-all duration-150"
                style={{ width: `${fissionProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 text-[10px] text-text-secondary">
            <span>生成份数:</span>
            {[3, 5, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setFissionCount(num)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border transition-all ${
                  fissionCount === num
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-border bg-bg text-text-muted hover:border-gold/40"
                }`}
              >
                {num}份
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={isFissioning || isRendering}
            onClick={handleBatchFission}
            className="rounded-lg bg-gradient-to-r from-amber to-gold px-3 py-1.5 text-[11px] font-black text-zinc-950 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isFissioning ? "裂变压制中..." : `批量生成 ${fissionCount} 份成片`}
          </button>
        </div>
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

        {/* 成片压制完成后的定位操作 */}
        {renderedVideoPath && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 truncate max-w-[200px]">
              <span>✓</span>
              <span>成片已保存</span>
            </span>
            <button
              type="button"
              onClick={handleOpenVideoFolder}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-primary hover:border-gold hover:text-gold transition-colors"
            >
              <span>📂</span>
              <span>在文件夹中定位成片</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
