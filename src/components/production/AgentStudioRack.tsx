/**
 * dramaxis v1.1.0 · AgentStudioRack · 6-Agent 智能体机架与思考控制台
 */

import { memo, useState } from "react";
import type { AgentMessage, BreakpointRequest, AgentRole, Blackboard } from "@dramaxis/ipc";

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
  blackboard?: Blackboard | null;
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
  blackboard,
  onApproveBreakpoint,
}: AgentStudioRackProps) {
  const [feedbackText, setFeedbackText] = useState("");

  const activeScript =
    blackboard?.scriptVersions?.[blackboard.activeScriptIndex] ||
    blackboard?.scriptVersions?.[blackboard.scriptVersions.length - 1];

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* 三档人机协同策略切换 */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-bg p-2.5">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-text-secondary">
            人机协同决策策略 (HITL)
          </span>
          <span className="text-[10px] text-text-muted">
            {agentAutoMode ? "🚀 全自动批量生产模式" : "🤝 关键决策点暂停审核 (推荐)"}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => onToggleAutoMode(true)}
            className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
              agentAutoMode
                ? "bg-gold text-zinc-950 font-bold shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            全自动
          </button>
          <button
            type="button"
            onClick={() => onToggleAutoMode(false)}
            className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
              !agentAutoMode
                ? "bg-gold text-zinc-950 font-bold shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            半自动审核
          </button>
        </div>
      </div>

      {/* 剧本版本链徽章 */}
      {blackboard && blackboard.scriptVersions.length > 0 && (
        <div className="flex items-center justify-between px-2 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>黑板总线: 当前草稿版本</span>
            <span className="font-mono font-bold text-gold">
              v{activeScript?.version || 1}
            </span>
            <span className="text-text-muted">
              (共 {blackboard.scriptVersions.length} 版)
            </span>
          </span>
          {activeScript?.critiqueFeedback && (
            <span className="text-[10px] text-amber-400 truncate max-w-[140px]" title={activeScript.critiqueFeedback}>
              已融合反思建议
            </span>
          )}
        </div>
      )}

      {/* HITL 决策卡片 (支持对话式自然语言精修) */}
      {breakpoint && (
        <div className="rounded-xl border border-gold bg-gold-muted p-3 space-y-2.5 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-gold flex items-center gap-1">
              <span>⚠️</span>
              <span>智能体断点等待审批: {breakpoint.step_title}</span>
            </span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-secondary">
              {breakpoint.agent}
            </span>
          </div>

          <p className="text-[11px] text-text-primary bg-bg p-2 rounded border border-border max-h-24 overflow-y-auto whitespace-pre-wrap font-sans">
            {breakpoint.content}
          </p>

          {/* 对话式精修输入框 */}
          <div className="space-y-1">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="💡 输入靶向精修意见 (如：把前3秒反转加剧，主角语气更冷峻)..."
              className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-gold placeholder:text-text-muted"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                onApproveBreakpoint(false, feedbackText || "重新微调剧本");
                setFeedbackText("");
              }}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-secondary hover:text-amber-400 hover:border-amber-400/50 transition-colors"
            >
              {feedbackText ? "💬 携带指令靶向改写" : "打回重拟"}
            </button>
            <button
              type="button"
              onClick={() => {
                onApproveBreakpoint(true);
                setFeedbackText("");
              }}
              className="rounded-lg bg-gold px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:brightness-110 shadow-sm transition-all"
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
