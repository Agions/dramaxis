/**
 * dramaxis · assets/batch.tsx · 批量矩阵排产与持久化后台任务队列面板 (P2-1)
 *
 * 接入 SQLite WAL 持久化队列：创建批处理任务、查询状态、原子推进执行与取消任务。
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  batchIpc,
  type BatchJob,
  type BatchJobStatus,
  type BatchJobType,
} from "@dramaxis/ipc";
import { useProject } from "@hooks/project";

const JOB_TYPE_LABELS: Record<BatchJobType, string> = {
  asr_transcribe: "ASR 语音转写",
  scene_analysis: "VLM 视觉场景分析",
  script_generation: "解说文案批量生成",
  voice_synthesis: "批量配音合成",
  master_render: "母带压制渲染",
  full_fission: "全流程矩阵裂变",
};

const STATUS_BADGE: Record<BatchJobStatus, { text: string; cls: string }> = {
  pending: {
    text: "排队中",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  running: {
    text: "执行中",
    cls: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  completed: {
    text: "已完成",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  failed: {
    text: "失败",
    cls: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  cancelled: {
    text: "已取消",
    cls: "bg-white/5 text-text-muted border-white/10",
  },
};

export function BatchQueuePanel() {
  const { project, currentPath } = useProject();
  const qc = useQueryClient();
  const bundlePath = currentPath ?? null;

  const [jobType, setJobType] = useState<BatchJobType>("full_fission");
  const [payloadNote, setPayloadNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: jobs = [], isFetching } = useQuery({
    queryKey: ["batch-jobs", bundlePath],
    queryFn: () => batchIpc.listJobs(null, null, 20, bundlePath),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["batch-jobs", bundlePath] });
  };

  const handleCreateJob = async () => {
    setIsCreating(true);
    try {
      const payload = JSON.stringify({
        projectId: project?.id ?? null,
        projectName: project?.name ?? "默认工程",
        note: payloadNote.trim() || "标准批量排产任务",
        submittedAt: new Date().toISOString(),
      });
      await batchIpc.createJob(
        payload,
        jobType,
        project?.id ?? null,
        0,
        bundlePath,
      );
      setPayloadNote("");
      refresh();
      toast.success(`已提交「${JOB_TYPE_LABELS[jobType]}」至持久化任务队列`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("创建批量任务失败", {
        description: err?.message ?? String(e),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleProcessNext = async () => {
    setIsProcessing(true);
    try {
      const job: BatchJob | null = await batchIpc.processNext(bundlePath);
      refresh();
      if (!job) {
        toast.info("当前队列没有待处理的 Pending 任务");
      } else if (job.status === "completed") {
        toast.success(`任务 ${job.id.slice(0, 8)} 已调度完成`);
      } else {
        toast.warning(`任务状态：${job.status}`, {
          description: job.errorMessage ?? undefined,
        });
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("队列推进失败", {
        description: err?.message ?? String(e),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await batchIpc.cancelJob(id, bundlePath);
      refresh();
      toast.success("任务已取消");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("取消任务失败", {
        description: err?.message ?? String(e),
      });
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <span>🏭</span>
            <span>批量矩阵排产与持久化后台队列 (SQLite WAL)</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            支持多风格 / 多集任务原子排队、崩溃自动恢复与重试退避
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            className="rounded-lg border border-border bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] text-text-primary disabled:opacity-50"
          >
            {isFetching ? "刷新中..." : "刷新"}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void handleProcessNext()}
            className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-200 transition-all disabled:opacity-50"
          >
            {isProcessing ? "调度中..." : "▶ 执行下一条"}
          </button>
        </div>
      </div>

      {/* 入队控制栏 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value as BatchJobType)}
          className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
        >
          {(Object.keys(JOB_TYPE_LABELS) as BatchJobType[]).map((t) => (
            <option key={t} value={t}>
              {JOB_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={payloadNote}
          onChange={(e) => setPayloadNote(e.target.value)}
          placeholder="任务备注或参数标签 (如：第1-5集 抖音爽剧风)..."
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-primary"
        />
        <button
          type="button"
          disabled={isCreating}
          onClick={() => void handleCreateJob()}
          className="rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 px-4 py-1.5 text-xs font-bold text-gold transition-all disabled:opacity-50"
        >
          {isCreating ? "入队中..." : "+ 提交批处理任务"}
        </button>
      </div>

      {/* 任务列表 */}
      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-5 text-center text-[11px] text-text-muted">
          当前队列暂无任务，可选择上方算子一键提交批处理任务
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {jobs.map((job) => {
            const badge = STATUS_BADGE[job.status];
            return (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">
                      {JOB_TYPE_LABELS[job.jobType]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">
                      #{job.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted font-mono truncate">
                    进度 {Math.round(job.progress)}% · 重试 {job.retryCount}/
                    {job.maxRetries} · {job.payloadJson}
                  </div>
                </div>

                {(job.status === "pending" || job.status === "running") && (
                  <button
                    type="button"
                    onClick={() => void handleCancel(job.id)}
                    className="shrink-0 rounded border border-white/10 bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 px-2 py-1 text-[10px] text-text-muted hover:text-red-300"
                  >
                    取消
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
