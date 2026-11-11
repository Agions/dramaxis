/**
 * dramaxis v1.2.0 · ExportStudioPanel · 剪映原生工程草稿与多平台交付工坊
 *
 * 全真实数据导出与硬件加速渲染中枢:
 * - 剪映原生 PC 工程草稿 (.draft) 全真实材料与多轨组装导出
 * - 多平台直接渲染 MP4 视频 (抖音/B站/小红书/快手)
 * - 实时 FFmpeg 硬件加速压制进度条 (export://progress)
 * - 多平台母带定制 (自适应微调 + 9:16 环境高斯模糊底衬 + 多版本批量导出)
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
import { CapcutDraftCard } from "./export/CapcutDraftCard";
import { DedupMatrixCard } from "./export/DedupMatrixCard";
import { PlatformRenderCard } from "./export/PlatformRenderCard";
import { parseCutPoint } from "@dramaxis/utils";

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
  const [exportedDraft, setExportedDraft] = useState<CapcutDraftResult | null>(null);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);

  const handleOpenDraftFolder = async () => {
    if (!exportedDraft) return;
    try {
      await exportIpc.openFolder(exportedDraft.draftFolder);
      toast.success("已在文件资源管理器中定位草稿文件夹");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`打开草稿目录失败: ${err?.message || String(e)}`);
    }
  };

  const handleLaunchJianying = async () => {
    try {
      await exportIpc.launchJianying();
      toast.success("已尝试唤起剪映 PC 端");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`唤起剪映失败: ${err?.message || String(e)}`);
    }
  };

  const handleOpenVideoFolder = async () => {
    if (!renderedVideoPath) return;
    try {
      await exportIpc.openFolder(renderedVideoPath);
      toast.success("已在文件资源管理器中定位成片文件");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`定位成片文件失败: ${err?.message || String(e)}`);
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
      toast.info("已切换至【工业标准】母带模式 (推荐)");
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
      toast.info("已切换至【多渠道定制】母带微调模式");
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

  // 监听批量裂变矩阵进度
  useTauriEvent<FissionProgressPayload>("export://fission_progress", (e) => {
    if (e.payload) {
      setFissionProgress(Math.round(e.payload.percent));
      setFissionMessage(e.payload.message);
    }
  });

  const handleExportJianying = async () => {
    const mediaFile = currentProject?.project?.media_files?.[0]?.path;
    const mediaDuration =
      currentProject?.project?.media_files?.[0]?.duration_seconds;
    if (!mediaFile) {
      toast.error("未检测到主摄视频素材，请先导入素材");
      return;
    }

    setIsExportingDraft(true);
    try {
      const cutPoints = sceneCuts.map((c) => parseCutPoint(c.time));

      const res = await exportIpc.capcutDraft({
        projectName: currentProject.project.name || "Dramaxis 电影工程",
        videoPath: mediaFile,
        videoDurationSeconds: mediaDuration || 60,
        voicePath: voiceAudioPath ?? null,
        voiceDurationSeconds: voiceDuration || 0,
        antiDupZoom,
        enableAmbientBlur,
        subtitles: subtitles.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.start + s.duration,
        })),
        sceneCuts: cutPoints.length > 0 ? cutPoints : [],
        ambientPath: ambientPath ?? null,
        ambientVolume,
        bgmPath: bgmPath ?? null,
        bgmVolume,
        enableAudioDucking,
        bgmDuckingLevel,
        subtitleStyle,
      });

      setExportedDraft(res);
      toast.success("剪映草稿工程已直接同步至剪映首页！", {
        description: `草稿目录: ${res.draftFolder}`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("导出剪映工程草稿失败", {
        description: err?.message ?? "请检查本地剪映安装路径与权限",
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
      const cutPoints = sceneCuts.map((c) => parseCutPoint(c.time));

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
        sceneCuts: cutPoints.length > 0 ? cutPoints : [],
        bgmPath: bgmPath ?? null,
        bgmVolume,
        enableAudioDucking,
        subtitleStyle,
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
    setFissionMessage(`启动 ${fissionCount} 份多版本母带导出流水线...`);

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
      const cutPoints = sceneCuts.map((c) => parseCutPoint(c.time));

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
        sceneCuts: cutPoints.length > 0 ? cutPoints : [],
        bgmPath: bgmPath ?? null,
        bgmVolume,
        enableAudioDucking,
        subtitleStyle,
      });

      toast.success(`成功批量导出 ${res.variants.length} 份定制母带！`, {
        description: `各版本参数差异化适配，可直接分发各平台渠道`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("批量导出失败", {
        description: err?.message ?? "请检查 FFmpeg 与素材参数",
      });
    } finally {
      setIsFissioning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 剪映原生草稿卡片 */}
      <CapcutDraftCard
        isExportingDraft={isExportingDraft}
        exportedDraft={exportedDraft}
        onExportJianying={handleExportJianying}
        onOpenDraftFolder={handleOpenDraftFolder}
        onLaunchJianying={handleLaunchJianying}
        ambientLabel={ambientLabel}
        ambientPath={ambientPath}
        ambientVolume={ambientVolume}
        onSelectAmbientAudio={handleSelectAmbientAudio}
        onAmbientVolumeChange={setAmbientVolume}
        bgmLabel={bgmLabel}
        bgmPath={bgmPath}
        bgmVolume={bgmVolume}
        onSelectBgmAudio={handleSelectBgmAudio}
        onBgmVolumeChange={setBgmVolume}
        subtitleStyle={subtitleStyle}
        onSubtitleStyleChange={setSubtitleStyle}
        enableAudioDucking={enableAudioDucking}
        onEnableAudioDuckingChange={setEnableAudioDucking}
        bgmDuckingLevel={bgmDuckingLevel}
        onBgmDuckingLevelChange={setBgmDuckingLevel}
      />

      {/* 8 维消重矩阵与批量裂变卡片 */}
      <DedupMatrixCard
        antiDupZoom={antiDupZoom}
        onAntiDupZoomChange={onAntiDupZoomChange}
        enableAmbientBlur={enableAmbientBlur}
        onEnableAmbientBlurChange={onEnableAmbientBlurChange}
        dedupIntensity={dedupIntensity}
        onApplyPreset={handleApplyPreset}
        showAdvancedDedup={showAdvancedDedup}
        onToggleAdvancedDedup={() => setShowAdvancedDedup(!showAdvancedDedup)}
        enableSpeed={enableSpeed}
        onEnableSpeedChange={setEnableSpeed}
        speedRate={speedRate}
        onSpeedRateChange={setSpeedRate}
        enableMirror={enableMirror}
        onEnableMirrorChange={setEnableMirror}
        enableNoise={enableNoise}
        onEnableNoiseChange={setEnableNoise}
        noiseStrength={noiseStrength}
        onNoiseStrengthChange={setNoiseStrength}
        enableFpsDrift={enableFpsDrift}
        onEnableFpsDriftChange={setEnableFpsDrift}
        enablePitchShift={enablePitchShift}
        onEnablePitchShiftChange={setEnablePitchShift}
        pitchShiftRate={pitchShiftRate}
        onPitchShiftRateChange={setPitchShiftRate}
        enableBgmReverb={enableBgmReverb}
        onEnableBgmReverbChange={setEnableBgmReverb}
        enableMetadataScrub={enableMetadataScrub}
        onEnableMetadataScrubChange={setEnableMetadataScrub}
        isFissioning={isFissioning}
        isRendering={isRendering}
        fissionCount={fissionCount}
        onFissionCountChange={setFissionCount}
        fissionProgress={fissionProgress}
        fissionMessage={fissionMessage}
        onBatchFission={handleBatchFission}
      />

      {/* 多平台直导与硬件加速压制卡片 */}
      <PlatformRenderCard
        isRendering={isRendering}
        activePreset={activePreset}
        renderProgress={renderProgress}
        renderPhase={renderPhase}
        renderedVideoPath={renderedVideoPath}
        onRenderPreset={handleRenderVideo}
        onOpenVideoFolder={handleOpenVideoFolder}
      />
    </div>
  );
});
