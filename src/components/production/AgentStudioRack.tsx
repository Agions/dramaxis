/**
 * splicr v1.0.1 · AgentStudioRack · 6-Agent 智能体机架与思考控制台
 */

import { memo } from "react";
import type { AgentMessage, BreakpointRequest, AgentRole } from "@splicr/ipc";

export interface AgentStepMeta {
  id: number;
  role: AgentRole;
  name: string;
  en: string;
  icon: string;
  desc: string;
}

export const AGENT_STEPS: AgentStepMeta[] = [
  {
    id: 1,
    role: "director",
    name: "总控导演",
    en: "Director",
    icon: "🎬",
    desc: "任务拆解与全流程分发",
  },
  {
    id: 2,
    role: "visual_critic",
    name: "视觉分析",
    en: "VisualCritic",
    icon: "👁️",
    desc: "关键帧提取与情绪打点",
  },
  {
    id: 3,
    role: "screenwriter",
    name: "金牌编剧",
    en: "Screenwriter",
    icon: "✍️",
    desc: "0~3s Hook 与高能独白",
  },
  {
    id: 4,
    role: "voice_artist",
    name: "声乐调音",
    en: "VoiceArtist",
    icon: "🎙️",
    desc: "音色选型与 48kHz 配音",
  },
  {
    id: 5,
    role: "sound_engineer",
    name: "混音剪辑",
    en: "SoundEngineer",
    icon: "🎛️",
    desc: "5 轨吸附与 BGM 避让",
  },
  {
    id: 6,
    role: "quality_reviewer",
    name: "质量验收",
    en: "QualityReviewer",
    icon: "🔍",
    desc: "违禁词与草稿质检",
  },
];

interface AgentStudioRackProps {
  currentStepIndex: number;
  isAgentRunning: boolean;
  agentAutoMode: boolean;
  onToggleAutoMode: (val: boolean) => void;
  onStartPipeline: () => void;
  agentMessages: AgentMessage[];
  breakpoint: BreakpointRequest | null;
  onApproveBreakpoint: (approved: boolean, feedback?: string) => void;
}

export const AgentStudioRack = memo(function AgentStudioRack({
  currentStepIndex: _currentStepIndex,
  isAgentRunning,
  agentAutoMode,
  onToggleAutoMode,
  onStartPipeline,
  agentMessages,
  breakpoint,
  onApproveBreakpoint,
}: AgentStudioRackProps) {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* 人机协同模式切换 */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-bg p-2.5">
        <span className="text-xs font-semibold text-text-secondary">
          人机协作断点 (HITL)
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!agentAutoMode}
            onChange={(e) => onToggleAutoMode(!e.target.checked)}
            className="rounded accent-gold"
          />
          <span className="text-[11px] font-mono text-text-primary">
            关键节点人工审核
          </span>
        </label>
      </div>

      {/* HITL 决策卡片 */}
      {breakpoint && (
        <div className="rounded-xl border border-gold bg-gold-muted p-3 space-y-2 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-gold flex items-center gap-1">
              <span>⚠️</span>
              <span>智能体断点等待批准: {breakpoint.step_title}</span>
            </span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-secondary">
              {breakpoint.agent}
            </span>
          </div>
          <p className="text-[11px] text-text-primary bg-bg p-2 rounded border border-border max-h-24 overflow-y-auto whitespace-pre-wrap font-sans">
            {breakpoint.content}
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => onApproveBreakpoint(false, "重写")}
              className="rounded-lg border border-border bg-bg px-3 py-1 text-xs text-text-secondary hover:text-rose-400"
            >
              打回重拟
            </button>
            <button
              type="button"
              onClick={() => onApproveBreakpoint(true)}
              className="rounded-lg bg-gold px-3 py-1 text-xs font-bold text-zinc-950 hover:brightness-110 shadow-sm"
            >
              批准并继续 ➔
            </button>
          </div>
        </div>
      )}

      {/* Agent 实时思考与动态流 */}
      <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-bg p-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-[11px] font-bold text-text-secondary">
            Agent 思考流与决策日志
          </span>
          <span className="font-mono text-[9px] text-gold">
            {isAgentRunning ? "● ACTIVE" : "IDLE"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pt-2 space-y-2 font-mono text-xs">
          {agentMessages.length > 0 ? (
            agentMessages.map((m, idx) => (
              <div
                key={m.id || idx}
                className="flex flex-col gap-0.5 rounded p-1.5 bg-surface-elevated/40 border border-border"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-gold">[{m.sender}]</span>
                  <span className="text-text-muted">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {m.thought && (
                  <div className="text-[10px] text-text-muted italic">
                    💭 {m.thought}
                  </div>
                )}
                {m.action && (
                  <div className="text-[11px] text-emerald-400 font-medium">
                    ⚡ 动作: {m.action} ➔ {m.observation}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-center text-text-muted text-xs gap-1">
              <span>🤖 智能体团队处于待机状态</span>
              <span className="text-[10px]">
                导入素材或点击下方按钮启动自适应流水线
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onStartPipeline}
        disabled={isAgentRunning}
        className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
      >
        {isAgentRunning
          ? "🤖 智能体接力中..."
          : "⚡ 启动 Multi-Agent 自适应流水线"}
      </button>
    </div>
  );
});
