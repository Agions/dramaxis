/**
 * dramaxis v1.2.0 · 生产工作台左侧机架与切片栏 (ProductionLeftSidebar)
 *
 * 核心升级:
 * - 动态绑定 3 档 Multi-Agent 工作流模板 (标准微短剧 9 节点 / 极速解说 7 节点 / 高光混剪 4 节点)
 * - 与后端 DAG 执行器 (DagSnapshot) 1:1 实时拓扑映射 (状态/耗时/反思闭环)
 * - 智能平滑回退: 运行前展示模板静态预期拓扑，运行时实时响应 DAG 节点推进
 * - 集成 W1 Scene-RAG 镜头切片与情绪特征提取列表
 */

import { memo, useMemo } from "react";
import { SceneCutsList } from "@components/production/SceneCutsList";
import { usePlaybackStore, useWorkshopStore } from "@dramaxis/core";
import type {
  AgentRole,
  DagNodeStatus,
  DagSnapshot,
  WorkflowProfile,
} from "@dramaxis/ipc";

interface SidebarDagNode {
  id: string;
  name: string;
  role: AgentRole;
  icon: string;
  desc: string;
  isHitl?: boolean;
}

const PROFILE_TEMPLATES: Record<WorkflowProfile, SidebarDagNode[]> = {
  standard_drama: [
    {
      id: "director_plan",
      name: "总控导演",
      role: "director",
      icon: "🎬",
      desc: "统筹策划与任务派发",
    },
    {
      id: "visual_analysis",
      name: "视觉分析",
      role: "visual_critic",
      icon: "👁️",
      desc: "场景突变硬切与关键帧萃取",
    },
    {
      id: "dialogue_probe",
      name: "音频分析",
      role: "sound_engineer",
      icon: "🎧",
      desc: "原片对白与情绪节奏探测",
    },
    {
      id: "screenwriter_draft",
      name: "金牌编剧",
      role: "screenwriter",
      icon: "✍️",
      desc: "第一人称爆款独白撰写",
    },
    {
      id: "critic_review",
      name: "剧本质检",
      role: "quality_reviewer",
      icon: "🔍",
      desc: "节奏密度与前3秒评审闭环",
    },
    {
      id: "hitl_approval",
      name: "人机协同",
      role: "director",
      icon: "🤝",
      desc: "剧本精修与终版确认 (HITL)",
      isHitl: true,
    },
    {
      id: "voice_synthesis",
      name: "配音师",
      role: "voice_artist",
      icon: "🎙️",
      desc: "48kHz 影视广播级人声合成",
    },
    {
      id: "timeline_compose",
      name: "调音剪辑",
      role: "sound_engineer",
      icon: "🎛️",
      desc: "5 轨毫秒级磁吸与避让",
    },
    {
      id: "quality_gate",
      name: "终审守门",
      role: "quality_reviewer",
      icon: "🛡️",
      desc: "视听合规与草稿质检验收",
    },
  ],
  fast_commentary: [
    {
      id: "director_plan",
      name: "总控导演",
      role: "director",
      icon: "🎬",
      desc: "极速解说策划与任务派发",
    },
    {
      id: "visual_analysis",
      name: "视觉分析",
      role: "visual_critic",
      icon: "👁️",
      desc: "高光关键帧快速萃取",
    },
    {
      id: "screenwriter_draft",
      name: "金牌编剧",
      role: "screenwriter",
      icon: "✍️",
      desc: "短剧快节奏解说文案",
    },
    {
      id: "hitl_approval",
      name: "人机协同",
      role: "director",
      icon: "🤝",
      desc: "解说文案确认 (HITL)",
      isHitl: true,
    },
    {
      id: "voice_synthesis",
      name: "配音师",
      role: "voice_artist",
      icon: "🎙️",
      desc: "极速拟真语音合成",
    },
    {
      id: "timeline_compose",
      name: "混音剪辑",
      role: "sound_engineer",
      icon: "🎛️",
      desc: "音画磁吸与动态字幕对齐",
    },
    {
      id: "quality_gate",
      name: "终审守门",
      role: "quality_reviewer",
      icon: "🛡️",
      desc: "交付合规审查",
    },
  ],
  pure_broll_montage: [
    {
      id: "director_plan",
      name: "总控导演",
      role: "director",
      icon: "🎬",
      desc: "高光混剪结构规划",
    },
    {
      id: "visual_analysis",
      name: "视觉分析",
      role: "visual_critic",
      icon: "👁️",
      desc: "情绪卡点与硬切点识别",
    },
    {
      id: "timeline_compose",
      name: "混音剪辑",
      role: "sound_engineer",
      icon: "🎛️",
      desc: "视听节奏对齐与 B-roll 卡点",
    },
    {
      id: "quality_gate",
      name: "终审守门",
      role: "quality_reviewer",
      icon: "🛡️",
      desc: "混剪成片质量验收",
    },
  ],
};

const ROLE_ICONS: Record<AgentRole, string> = {
  director: "🎬",
  visual_critic: "👁️",
  screenwriter: "✍️",
  voice_artist: "🎙️",
  sound_engineer: "🎛️",
  quality_reviewer: "🔍",
};

export interface ProductionLeftSidebarProps {
  currentStepIndex: number;
  mediaPath?: string | null;
  workflowProfile?: WorkflowProfile;
  dagSnapshot?: DagSnapshot | null;
  isAgentRunning?: boolean;
}

export const ProductionLeftSidebar = memo(function ProductionLeftSidebar({
  currentStepIndex,
  mediaPath,
  workflowProfile = "standard_drama",
  dagSnapshot = null,
  isAgentRunning = false,
}: ProductionLeftSidebarProps) {
  const sceneCuts = useWorkshopStore((s) => s.sceneCuts);
  const setSceneCuts = useWorkshopStore((s) => s.setSceneCuts);
  const markDirty = useWorkshopStore((s) => s.markDirty);
  const seek = usePlaybackStore((s) => s.seek);

  // 1. 解析当前拓扑节点
  const activeNodes = useMemo(() => {
    // 若已有运行时快照，使用后端推送的真实节点列表
    if (dagSnapshot && dagSnapshot.nodes && dagSnapshot.nodes.length > 0) {
      return dagSnapshot.nodes.map((n) => {
        const cleanName = n.name.includes(" ")
          ? n.name.replace(/^[^\s]+\s*/, "")
          : n.name;
        const icon = ROLE_ICONS[n.role] || "🤖";
        return {
          id: n.id,
          name: cleanName,
          role: n.role,
          icon,
          desc: n.summary || `Agent: ${n.role}`,
          status: n.status,
          durationMs: n.durationMs,
          isHitl: n.id.includes("hitl"),
        };
      });
    }

    // 默认展示所选模板的静态拓扑
    const template =
      PROFILE_TEMPLATES[workflowProfile] || PROFILE_TEMPLATES.standard_drama;
    return template.map((t, idx) => {
      let status: DagNodeStatus = "pending";
      if (currentStepIndex === idx) {
        status = "running";
      } else if (currentStepIndex > idx) {
        status = "completed";
      }
      return {
        ...t,
        status,
        durationMs: 0,
      };
    });
  }, [dagSnapshot, workflowProfile, currentStepIndex]);

  // 2. 状态文案与进度
  const completedCount = dagSnapshot
    ? dagSnapshot.completedNodes
    : activeNodes.filter((n) => n.status === "completed").length;
  const totalCount = activeNodes.length;

  return (
    <aside className="flex flex-col border-r border-border bg-surface p-3 gap-3 overflow-y-auto">
      {/* ── DAG 拓扑节点机架 ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              DAG 流水线 ({completedCount}/{totalCount})
            </span>
          </div>
          <span className="rounded bg-surface-elevated border border-border px-1.5 py-0.2 font-mono text-[8px] font-bold text-gold">
            {dagSnapshot?.inCritiqueLoop
              ? `反思自愈 #${dagSnapshot.critiqueCount}`
              : isAgentRunning
                ? "RUNNING"
                : "READY"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {activeNodes.map((node) => {
            const isRunning = node.status === "running";
            const isCompleted = node.status === "completed";
            const isFailed = node.status === "failed";
            const isSkipped = node.status === "skipped";

            return (
              <div
                key={node.id}
                className={`flex flex-col rounded-lg border p-2 transition-all ${
                  isRunning
                    ? "border-gold bg-gold-muted shadow-sm ring-1 ring-gold/40"
                    : isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/5 text-text-secondary"
                      : isFailed
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : isSkipped
                          ? "border-border/50 bg-bg/40 opacity-50"
                          : "border-border bg-bg/80 text-text-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs shrink-0">{node.icon}</span>
                    <span className="text-xs font-bold text-text-primary truncate">
                      {node.name}
                    </span>
                    {node.isHitl && (
                      <span className="rounded bg-amber-500/20 px-1 py-0.1 text-[8px] font-mono text-amber-400 font-bold shrink-0">
                        HITL
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] shrink-0 ml-1">
                    {isCompleted ? (
                      <span className="text-emerald-400 font-bold">
                        ✓ {node.durationMs ? `${node.durationMs}ms` : ""}
                      </span>
                    ) : isRunning ? (
                      <span className="text-gold animate-pulse">● 运行中</span>
                    ) : isFailed ? (
                      <span className="text-rose-400 font-bold">✗ 失败</span>
                    ) : isSkipped ? (
                      <span className="text-text-muted">— 跳过</span>
                    ) : (
                      <span className="text-text-muted">○</span>
                    )}
                  </span>
                </div>
                <span className="text-[9px] text-text-muted mt-0.5 truncate">
                  {node.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-[1px] w-full bg-border" />

      {/* 场景切片列表模块 */}
      <SceneCutsList
        sceneCuts={sceneCuts}
        onSetSceneCuts={(cuts) => {
          setSceneCuts(cuts);
          markDirty("timelineDirty", true);
          markDirty("exportDirty", true);
        }}
        mediaPath={mediaPath}
        onSeek={seek}
      />
    </aside>
  );
});
