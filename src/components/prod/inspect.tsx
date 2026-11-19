/**
 * dramaxis v1.3.0 · 生产工作台右侧多智能体与创作工坊检视器 (ProductionInspector)
 *
 * 核心功能:
 * - 4 大标签页切换 (Agent 协同 / 剧本策划 / 配音克隆 / 矩阵交付)
 * - 创新「文音双联」工作区 (Dual-Dock Mode: 剧本与配音同屏实时对齐)
 * - 协同对接 AgentStudioRack、ScriptStudioPanel、VoiceStudioPanel、ExportStudioPanel
 * - 统一通过 useWorkshopStore 进行跨工坊参数驱动与脏标记联动
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { memo, useState } from "react";
import { AgentStudioRack } from "@components/prod/rack";
import { ScriptStudioPanel } from "@components/prod/script";
import { VoiceStudioPanel } from "@components/prod/voice";
import { ExportStudioPanel } from "@components/prod/export";
import { useWorkshopStore, type WorkshopTab } from "@dramaxis/core";
import type {
  AgentMessage,
  Blackboard,
  BreakpointRequest,
  ProjectRecord,
} from "@dramaxis/ipc";

interface ProductionInspectorProps {
  currentProject: ProjectRecord | null;
  currentStepIndex: number;
  isAgentRunning: boolean;
  agentAutoMode: boolean;
  onToggleAutoMode: (auto: boolean) => void;
  onStartAgent: () => void;
  agentMessages: AgentMessage[];
  breakpoint: BreakpointRequest | null;
  blackboard?: Blackboard | null;
  onApproveBreakpoint: (approved: boolean, feedback?: string) => Promise<void>;
  onGenerateScript: () => Promise<void>;
}

export const ProductionInspector = memo(function ProductionInspector({
  currentProject,
  currentStepIndex,
  isAgentRunning,
  agentAutoMode,
  onToggleAutoMode,
  onStartAgent,
  agentMessages,
  breakpoint,
  blackboard,
  onApproveBreakpoint,
  onGenerateScript,
}: ProductionInspectorProps) {
  const [isDualDock, setIsDualDock] = useState(false);

  const activeTab = useWorkshopStore((s) => s.activeTab);
  const setActiveTab = useWorkshopStore((s) => s.setActiveTab);
  const setActiveWorkshop = useWorkshopStore((s) => s.setActiveWorkshop);

  const llmProvider = useWorkshopStore((s) => s.llmProvider);
  const setLlmProvider = useWorkshopStore((s) => s.setLlmProvider);
  const scriptStyle = useWorkshopStore((s) => s.scriptStyle);
  const setScriptStyle = useWorkshopStore((s) => s.setScriptStyle);
  const userPrompt = useWorkshopStore((s) => s.userPrompt);
  const setUserPrompt = useWorkshopStore((s) => s.setUserPrompt);
  const scriptText = useWorkshopStore((s) => s.scriptText);
  const setScriptText = useWorkshopStore((s) => s.setScriptText);
  const isGeneratingScript = useWorkshopStore((s) => s.isGeneratingScript);

  const voiceEngine = useWorkshopStore((s) => s.voiceEngine);
  const setVoiceEngine = useWorkshopStore((s) => s.setVoiceEngine);
  const voiceAudioPath = useWorkshopStore((s) => s.voiceAudioPath);
  const setVoiceAudioPath = useWorkshopStore((s) => s.setVoiceAudioPath);
  const voiceDuration = useWorkshopStore((s) => s.voiceDuration);

  const antiDupZoom = useWorkshopStore((s) => s.antiDupZoom);
  const setAntiDupZoom = useWorkshopStore((s) => s.setAntiDupZoom);
  const enableAmbientBlur = useWorkshopStore((s) => s.enableAmbientBlur);
  const setEnableAmbientBlur = useWorkshopStore((s) => s.setEnableAmbientBlur);

  const subtitleSegments = useWorkshopStore((s) => s.subtitleSegments);
  const sceneCuts = useWorkshopStore((s) => s.sceneCuts);
  const markDirty = useWorkshopStore((s) => s.markDirty);

  const handleTabSwitch = (t: WorkshopTab) => {
    setIsDualDock(false);
    setActiveTab(t);
    if (t === "script") setActiveWorkshop("script");
    else if (t === "voice") setActiveWorkshop("timeline");
    else if (t === "export") setActiveWorkshop("export");
  };

  return (
    <aside className="flex flex-col bg-surface p-3.5 gap-3 overflow-y-auto">
      {/* 顶部检视器模式与双联按钮 */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
          {isDualDock ? "文音双联工坊" : "工坊检视器"}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !isDualDock;
            setIsDualDock(next);
            if (next) {
              setActiveWorkshop("script");
            }
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
            isDualDock
              ? "bg-gold/20 border-gold text-gold shadow-xs"
              : "bg-surface-elevated border-border text-text-muted hover:text-text-primary"
          }`}
          title="开启/关闭剧本与配音同屏双联调音台"
        >
          <span>🪟</span>
          <span>{isDualDock ? "退出双联" : "文音双联"}</span>
        </button>
      </div>

      {/* 顶部分页 Tab (双联模式下仍可点击单选切回) */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-bg p-1">
        {[
          { id: "agent" as const, label: "Agent", icon: "🧠" },
          { id: "script" as const, label: "剧本", icon: "✍️" },
          { id: "voice" as const, label: "克隆", icon: "🎙️" },
          { id: "export" as const, label: "交付", icon: "📤" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabSwitch(t.id)}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
              !isDualDock && activeTab === t.id
                ? "bg-surface text-gold shadow-sm border border-border"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 双联模式: 同时呈现「剧本工坊」与「配音克隆工坊」 */}
      {isDualDock ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gold/30 bg-surface-elevated/40 p-2.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-xs font-bold text-gold flex items-center gap-1.5">
                <span>✍️</span>
                <span>AI 独白剧本工坊</span>
              </span>
              <span className="text-[10px] text-text-muted font-mono">Panel 1</span>
            </div>
            <ScriptStudioPanel
              llmProvider={llmProvider}
              onLlmProviderChange={setLlmProvider}
              scriptStyle={scriptStyle}
              onScriptStyleChange={setScriptStyle}
              userPrompt={userPrompt}
              onUserPromptChange={setUserPrompt}
              scriptText={scriptText}
              onScriptTextChange={(text) => {
                setScriptText(text);
                markDirty("voiceDirty", Boolean(voiceAudioPath));
                markDirty("exportDirty", true);
              }}
              isGeneratingScript={isGeneratingScript}
              onGenerateScript={onGenerateScript}
              blackboard={blackboard}
            />
          </div>

          <div className="rounded-xl border border-gold/30 bg-surface-elevated/40 p-2.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-xs font-bold text-gold flex items-center gap-1.5">
                <span>🎙️</span>
                <span>48kHz 配音与人声克隆</span>
              </span>
              <span className="text-[10px] text-text-muted font-mono">Panel 2</span>
            </div>
            <VoiceStudioPanel
              voiceEngine={voiceEngine}
              onVoiceEngineChange={setVoiceEngine}
              scriptText={scriptText}
              onAudioGenerated={setVoiceAudioPath}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Tab 0: Multi-Agent 协同视窗 */}
          {activeTab === "agent" && (
            <AgentStudioRack
              currentStepIndex={currentStepIndex}
              isAgentRunning={isAgentRunning}
              agentAutoMode={agentAutoMode}
              onToggleAutoMode={onToggleAutoMode}
              onStartPipeline={onStartAgent}
              agentMessages={agentMessages}
              breakpoint={breakpoint}
              blackboard={blackboard}
              onApproveBreakpoint={onApproveBreakpoint}
            />
          )}

          {/* Tab 1: AI 独白剧本工坊 */}
          {activeTab === "script" && (
            <ScriptStudioPanel
              llmProvider={llmProvider}
              onLlmProviderChange={setLlmProvider}
              scriptStyle={scriptStyle}
              onScriptStyleChange={setScriptStyle}
              userPrompt={userPrompt}
              onUserPromptChange={setUserPrompt}
              scriptText={scriptText}
              onScriptTextChange={(text) => {
                setScriptText(text);
                markDirty("voiceDirty", Boolean(voiceAudioPath));
                markDirty("exportDirty", true);
              }}
              isGeneratingScript={isGeneratingScript}
              onGenerateScript={onGenerateScript}
              blackboard={blackboard}
            />
          )}

          {/* Tab 2: 人声克隆与 TTS */}
          {activeTab === "voice" && (
            <VoiceStudioPanel
              voiceEngine={voiceEngine}
              onVoiceEngineChange={setVoiceEngine}
              scriptText={scriptText}
              onAudioGenerated={setVoiceAudioPath}
            />
          )}

          {/* Tab 3: 8 维消重矩阵与剪映草稿交付工坊 */}
          {activeTab === "export" && (
            <ExportStudioPanel
              currentProject={currentProject}
              antiDupZoom={antiDupZoom}
              onAntiDupZoomChange={setAntiDupZoom}
              enableAmbientBlur={enableAmbientBlur}
              onEnableAmbientBlurChange={setEnableAmbientBlur}
              voiceAudioPath={voiceAudioPath}
              voiceDuration={voiceDuration}
              subtitles={subtitleSegments}
              sceneCuts={sceneCuts}
            />
          )}
        </>
      )}
    </aside>
  );
});
