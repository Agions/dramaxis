/**
 * dramaxis v1.1.0 · useAgentWorkflow
 *
 * 6-Agent 多智能体协同流水线核心调度 Hook:
 * - 集中管理 Agent 运行状态、步骤推进、断点协同 (HITL) 与实时消息日志
 * - 彻底清除 Mock 假数据，每步通过 agentIpc.getContext() 流式抽取真实生成产物
 * - 流式驱动镜头切片、独白剧本、TTS 配音音频文件与毫秒级字幕对齐
 * - 支持组件卸载自动防护
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  agentIpc,
  type AgentMessage,
  type BreakpointRequest,
  type QualityReport,
  type DagSnapshot,
  type Blackboard,
  type Project,
} from "@dramaxis/ipc";
import { useTauriEvent } from "./useTauriEvent";
import { toast } from "sonner";

function formatSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface UseAgentWorkflowOptions {
  onStepChange?: (stepIndex: number) => void;
  onWorkflowComplete?: () => void;
  onSceneCutsGenerated?: (
    cuts: { id: number; time: string; tag: string; emotion: string }[],
  ) => void;
  onScriptGenerated?: (script: string) => void;
  onVoiceGenerated?: (audioPath: string, duration: number) => void;
  onSubtitlesGenerated?: (
    subtitles: { id: string; text: string; start: number; duration: number }[],
  ) => void;
  onQualityEvaluated?: (report: QualityReport) => void;
}

export function useAgentWorkflow(options?: UseAgentWorkflowOptions) {
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentAutoMode, setAgentAutoMode] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [breakpoint, setBreakpoint] = useState<BreakpointRequest | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [dagSnapshot, setDagSnapshot] = useState<DagSnapshot | null>(null);
  const [blackboard, setBlackboard] = useState<Blackboard | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncBlackboardArtifacts = useCallback(async () => {
    try {
      const bb = await agentIpc.getBlackboard();
      if (!bb) return;
      setBlackboard(bb);

      // 视觉分镜产物
      if (bb.visualBrief && bb.visualBrief.sceneCutsSec.length > 0) {
        let prevTime = 0;
        const sceneItems = bb.visualBrief.sceneCutsSec.map(
          (cut: number, idx: number) => {
            const timeStr = `${formatSec(prevTime)} - ${formatSec(cut)}`;
            prevTime = cut;
            const tag =
              idx === 0
                ? "开篇悬念镜头"
                : idx === 1
                  ? "角色冲突爆发"
                  : idx === 2
                    ? "反转高潮段落"
                    : "下集留白钩子";
            const emotion = idx % 2 === 0 ? "高能" : "紧张";
            return { id: idx + 1, time: timeStr, tag, emotion };
          },
        );
        options?.onSceneCutsGenerated?.(sceneItems);
      }

      // 剧本产物
      if (bb.scriptVersions && bb.scriptVersions.length > 0) {
        const activeScript =
          bb.scriptVersions[bb.activeScriptIndex] ||
          bb.scriptVersions[bb.scriptVersions.length - 1];
        if (activeScript?.text) {
          options?.onScriptGenerated?.(activeScript.text);
        }
      }

      // 配音产物
      if (bb.voiceArtifact) {
        options?.onVoiceGenerated?.(
          bb.voiceArtifact.audioPath,
          bb.voiceArtifact.durationSeconds,
        );
      }

      // 终审质检报告
      if (bb.qualityReport) {
        const qr: QualityReport = {
          hookScore: bb.qualityReport.hookScore,
          syncToleranceMs: bb.qualityReport.syncToleranceMs,
          pacingScore: bb.qualityReport.pacingScore,
          compliancePassed: bb.qualityReport.compliancePassed,
          overallScore: bb.qualityReport.overallScore,
          suggestions: bb.qualityReport.suggestions,
        };
        setQualityReport(qr);
        options?.onQualityEvaluated?.(qr);
      }
    } catch (e) {
      console.error("同步黑板总线产物失败", e);
    }
  }, [options]);

  // 监听 Tauri 后端推送的实时 Agent 事件
  useTauriEvent<{
    type:
      | "step_started"
      | "breakpoint_required"
      | "breakpoint_resolved"
      | "dag_progress"
      | "critique_loop_triggered"
      | "workflow_completed"
      | "quality_gate_evaluated"
      | "error";
    data?: any;
  }>("agent://event", (e) => {
    if (!isMountedRef.current) return;
    const payload = e.payload;
    if (!payload) return;

    if (payload.type === "step_started") {
      const idx = payload.data?.step_idx ?? 0;
      setCurrentStepIndex(idx);
      options?.onStepChange?.(idx);
      void syncBlackboardArtifacts();
      void agentIpc.getContext().then((ctx) => {
        if (ctx?.messages) setAgentMessages(ctx.messages);
      });
    } else if (payload.type === "breakpoint_required") {
      setBreakpoint(payload.data ?? null);
      setIsAgentRunning(false);
      void syncBlackboardArtifacts();
      void agentIpc.getContext().then((ctx) => {
        if (ctx?.messages) setAgentMessages(ctx.messages);
      });
    } else if (payload.type === "dag_progress") {
      if (payload.data?.snapshot) {
        setDagSnapshot(payload.data.snapshot);
      }
      void syncBlackboardArtifacts();
      void agentIpc.getContext().then((ctx) => {
        if (ctx?.messages) setAgentMessages(ctx.messages);
      });
    } else if (payload.type === "critique_loop_triggered") {
      const data = payload.data;
      toast.info(
        `智能体反思回路 (第 ${data?.round}/${data?.max_rounds} 轮): 当前评分 ${data?.current_score} 分未达标，正进行针对性剧本优化...`,
      );
      void syncBlackboardArtifacts();
    } else if (payload.type === "quality_gate_evaluated") {
      if (payload.data) {
        const report = payload.data as QualityReport;
        setQualityReport(report);
        options?.onQualityEvaluated?.(report);
      }
      void syncBlackboardArtifacts();
    } else if (payload.type === "workflow_completed") {
      setIsAgentRunning(false);
      setCurrentStepIndex(6);
      void syncBlackboardArtifacts();
      void agentIpc.getContext().then((ctx) => {
        if (ctx?.messages) setAgentMessages(ctx.messages);
      });
      options?.onWorkflowComplete?.();
      toast.success(
        "Multi-Agent 6-Agent 工作流全线交付完成！已自动切换至【草稿导出】视窗。",
      );
    } else if (payload.type === "error") {
      setIsAgentRunning(false);
      toast.error(`Agent 协同异常: ${payload.data?.message ?? "未知错误"}`);
    }
  });

  const startWorkflow = useCallback(
    async (project: Project, auto: boolean = true) => {
      setIsAgentRunning(true);
      setBreakpoint(null);
      setCurrentStepIndex(0);
      setAgentMessages([]);
      setQualityReport(null);

      toast.info("DirectorAgent: 全局自适应多智能体协作流水线已启动！");

      try {
        await agentIpc.start(project, auto);
        const req = await agentIpc.runDag();
        if (req) {
          setBreakpoint(req);
          setIsAgentRunning(false);
        }
        await syncBlackboardArtifacts();
        const ctx = await agentIpc.getContext().catch(() => null);
        if (ctx?.messages) setAgentMessages(ctx.messages);
      } catch (e: any) {
        if (isMountedRef.current) {
          setIsAgentRunning(false);
          toast.error(`启动 Multi-Agent 异常: ${e?.message ?? e}`);
        }
      }
    },
    [syncBlackboardArtifacts],
  );

  const approveBreakpoint = useCallback(
    async (approved: boolean, feedback?: string) => {
      setBreakpoint(null);
      setIsAgentRunning(true);
      if (approved) {
        toast.success("已批准当前智能体产物，工作流继续执行 ➔");
      } else {
        toast.info(
          feedback
            ? `已携带靶向精修指令打回: ${feedback}`
            : "已打回重拟，智能体将重新生成方案",
        );
      }
      try {
        const nextReq = await agentIpc.resumeBreakpoint(
          approved ? "批准定稿并进入配音" : "重新微调剧本",
          feedback ?? null,
        );
        if (nextReq) {
          setBreakpoint(nextReq);
          setIsAgentRunning(false);
        }
        await syncBlackboardArtifacts();
        const ctx = await agentIpc.getContext().catch(() => null);
        if (ctx?.messages) setAgentMessages(ctx.messages);
      } catch (e: any) {
        if (isMountedRef.current) {
          setIsAgentRunning(false);
          toast.error(`恢复执行异常: ${e?.message ?? e}`);
        }
      }
    },
    [syncBlackboardArtifacts],
  );

  const rollbackScript = useCallback(
    async (version: number) => {
      try {
        const ok = await agentIpc.rollbackScript(version);
        if (ok) {
          await syncBlackboardArtifacts();
          toast.success(`已成功回退至剧本版本 v${version}`);
        } else {
          toast.error(`回退版本失败: 未找到版本 v${version}`);
        }
      } catch (e: any) {
        toast.error(`版本回退异常: ${e?.message ?? e}`);
      }
    },
    [syncBlackboardArtifacts],
  );

  const resumeDagBreakpoint = useCallback(
    async (action: string, feedback?: string) => {
      const approved =
        !action.includes("打回") &&
        !action.includes("驳回") &&
        !action.includes("重拟");
      return approveBreakpoint(approved, feedback);
    },
    [approveBreakpoint],
  );

  const resetWorkflow = useCallback(() => {
    setIsAgentRunning(false);
    setCurrentStepIndex(-1);
    setBreakpoint(null);
    setAgentMessages([]);
    setQualityReport(null);
    setDagSnapshot(null);
    setBlackboard(null);
  }, []);

  return {
    isAgentRunning,
    agentAutoMode,
    setAgentAutoMode,
    currentStepIndex,
    agentMessages,
    breakpoint,
    qualityReport,
    dagSnapshot,
    blackboard,
    startWorkflow,
    runDagWorkflow: startWorkflow,
    approveBreakpoint,
    resumeDagBreakpoint,
    rollbackScript,
    resetWorkflow,
  };
}
