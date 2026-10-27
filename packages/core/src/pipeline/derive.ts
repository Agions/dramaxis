/**
 * dramaxis v1.1.0 · 流水线状态派生 (纯函数,可单测)
 *
 * 设计:
 * - 不依赖 React / IPC / Store
 * - 由 usePipeline.ts 调用,也由测试单独验证
 * - 输入是后端 PipelineStatus + 前端 stepDefs,输出是 UI 直接消费的视图
 */

import type {
  PipelineState,
  PipelineStatus,
  StepStatus,
  Timeline,
  Track,
  Clip,
  AlignmentPlan,
} from "@dramaxis/ipc";

export interface PipelineStepView {
  id: string;
  label: string;
  status: StepStatus;
}

/** 简化的 step 定义 (usePipeline 入参只需要 id + label_zh) */
export interface StepDefLike {
  id: string;
  label_zh: string;
}

/**
 * 把 stepDefs 与后端 status 合并成 UI 用的 PipelineStepView 数组
 * - 后端缺数据 → 视为 "pending"
 * - 后端返回的 stepStatuses 数组比 defs 长 → 多余项截断
 * - 后端返回的数组比 defs 短 → 缺的视为 "pending"
 */
export function deriveSteps(
  stepDefs: StepDefLike[],
  status: PipelineStatus | null | undefined,
): PipelineStepView[] {
  return stepDefs.map((def, idx) => ({
    id: def.id,
    label: def.label_zh,
    status: (status?.stepStatuses?.[idx] ?? "pending") as StepStatus,
  }));
}

/** 找到第一个 status === "active" 的 step index (无 → -1) */
export function findActiveIndex(steps: PipelineStepView[]): number {
  return steps.findIndex((s) => s.status === "active");
}

/**
 * 计算整体进度百分比 (done 步骤数 / 总步骤数)
 * - totalSteps <= 0 时除数取 1,避免 NaN
 * - 返回 0-100 整数
 */
export function computePercent(
  status: PipelineStatus | null | undefined,
  totalSteps: number,
): number {
  const doneCount = (status?.stepStatuses ?? []).filter(
    (s: string) => s === "done",
  ).length;
  return Math.round((doneCount / Math.max(totalSteps, 1)) * 100);
}

/** PipelineState → 用户友好的中文标签 */
const PIPELINE_STATE_LABEL: Record<PipelineState, string> = {
  idle: "空闲",
  running: "运行中",
  done: "已完成",
  failed: "失败",
};

export function pipelineStateLabel(state: PipelineState): string {
  return PIPELINE_STATE_LABEL[state] ?? "未知";
}

/** StepStatus → 中文标签 */
const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "待执行",
  active: "执行中",
  done: "已完成",
  error: "失败",
};

export function stepStatusLabel(status: StepStatus): string {
  return STEP_STATUS_LABEL[status] ?? "未知";
}

// ════════════════════════════════════════════════════════════════════════
// 响应式标准 5 轨自动编译引擎 (Reactive Timeline Compilation)
// ════════════════════════════════════════════════════════════════════════

export interface StandardTimelineInput {
  videoPath?: string | null;
  videoDuration?: number;
  sceneCuts?: number[];
  voicePath?: string | null;
  voiceDuration?: number;
  subtitles?: { id: string; text: string; start: number; duration: number }[];
  bgmPath?: string | null;
  ambientPath?: string | null;
  hookDuration?: number;
  alignmentPlan?: AlignmentPlan | null;
}

/**
 * 纯函数: 根据工坊/Agent产物生成规范的 5 轨 Timeline (V1/A1/A2/A3/SUB)
 */
export function deriveStandardTimeline(input: StandardTimelineInput): Timeline {
  const {
    videoPath = "",
    videoDuration = 0,
    sceneCuts = [],
    voicePath = null,
    voiceDuration = 0,
    subtitles = [],
    bgmPath = null,
    ambientPath = null,
    alignmentPlan = null,
  } = input;

  const totalDuration = Math.max(videoDuration, voiceDuration, 1.0);

  // 1. V1 视频切片轨
  const videoClips: Clip[] = [];
  if (sceneCuts && sceneCuts.length > 0) {
    const sortedCuts = [...sceneCuts].sort((a, b) => a - b);
    let prev = 0;
    let targetCursor = 0;

    sortedCuts.forEach((cut, idx) => {
      const cutClamped = Math.min(cut, videoDuration > 0 ? videoDuration : cut);
      if (cutClamped > prev) {
        const segDur = cutClamped - prev;
        const speed = alignmentPlan?.matches?.[idx]?.speedAdjustment ?? 1.0;
        const targetDur = segDur / speed;

        videoClips.push({
          id: `clip-v-${idx}`,
          media_ref: videoPath || "",
          start_seconds: targetCursor,
          in_seconds: prev,
          out_seconds: cutClamped,
          volume: 1.0,
        });

        targetCursor += targetDur;
        prev = cutClamped;
      }
    });

    if (videoDuration > 0 && prev < videoDuration) {
      videoClips.push({
        id: `clip-v-${sortedCuts.length}`,
        media_ref: videoPath || "",
        start_seconds: targetCursor,
        in_seconds: prev,
        out_seconds: videoDuration,
        volume: 1.0,
      });
    }
  } else if (videoDuration > 0) {
    videoClips.push({
      id: "clip-v-0",
      media_ref: videoPath || "",
      start_seconds: 0,
      in_seconds: 0,
      out_seconds: videoDuration,
      volume: 1.0,
    });
  }

  // 2. A1 旁白轨
  const voiceClips: Clip[] = [];
  if (voicePath && voiceDuration > 0) {
    voiceClips.push({
      id: "clip-voice-0",
      media_ref: voicePath,
      start_seconds: 0,
      in_seconds: 0,
      out_seconds: voiceDuration,
      volume: 1.0,
    });
  }

  // 3. SUB 字幕轨
  const subtitleClips: Clip[] = subtitles.map((sub, idx) => ({
    id: `clip-sub-${sub.id || idx}`,
    media_ref: sub.text,
    start_seconds: sub.start,
    in_seconds: 0,
    out_seconds: sub.duration,
    volume: null,
  }));

  // 4. A3 BGM 轨
  const bgmClips: Clip[] = [];
  if (bgmPath) {
    bgmClips.push({
      id: "clip-bgm-0",
      media_ref: bgmPath,
      start_seconds: 0,
      in_seconds: 0,
      out_seconds: totalDuration,
      volume: 0.6,
    });
  }

  // 5. A2 环境音效轨
  const ambientClips: Clip[] = [];
  if (ambientPath) {
    ambientClips.push({
      id: "clip-ambient-0",
      media_ref: ambientPath,
      start_seconds: 0,
      in_seconds: 0,
      out_seconds: totalDuration,
      volume: 0.35,
    });
  }

  const tracks: Track[] = [
    { id: "track-v1", kind: "video", clips: videoClips },
    { id: "track-a1", kind: "voice", clips: voiceClips },
    { id: "track-a2", kind: "ambient", clips: ambientClips },
    { id: "track-a3", kind: "bgm", clips: bgmClips },
    { id: "track-sub", kind: "subtitle", clips: subtitleClips },
  ];

  return { tracks };
}
