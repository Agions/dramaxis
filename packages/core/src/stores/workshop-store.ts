/**
 * dramaxis v1.1.0 · 影视解说创作四大工坊领域状态 Store (WorkshopStore)
 *
 * 统一收敛:
 * - W1: 素材拆条与 Scene-RAG 镜头切片
 * - W2: 剧本策划、提示词、文案与留存张力波形
 * - W3: 毫秒级多轨精修、声画时空对齐与微变速
 * - W4: 8 维消重矩阵与剪映原生草稿交付
 * - 响应式脏标记管理 (DirtyState Tracker)
 */

import { create } from "zustand";
import type { AlignmentPlan, SceneVisualFeature } from "@dramaxis/ipc";

export type WorkshopKind = "assets" | "script" | "timeline" | "export";
export type WorkshopTab = "agent" | "script" | "voice" | "export";

export interface DirtyState {
  scenesDirty: boolean;
  scriptDirty: boolean;
  voiceDirty: boolean;
  timelineDirty: boolean;
  exportDirty: boolean;
}

export interface WorkshopSceneCut {
  id: number;
  time: string;
  tag: string;
  emotion: string;
  conflictScore?: number;
  motionIntensity?: number;
  visualSummary?: string;
  rawFeature?: SceneVisualFeature;
}

export interface SubtitleSegment {
  id: string;
  text: string;
  start: number;
  duration: number;
}

export interface WorkshopState {
  // 工坊导航
  activeWorkshop: WorkshopKind;
  activeTab: WorkshopTab;

  // W1 素材与切片
  sceneCuts: WorkshopSceneCut[];
  subtitleSegments: SubtitleSegment[];

  // W2 剧本
  llmProvider: string;
  scriptStyle: "immersive" | "critic" | "story" | "roast";
  userPrompt: string;
  scriptText: string;
  isGeneratingScript: boolean;

  // W3 配音与声画对齐
  voiceEngine: string;
  voiceAudioPath: string | null;
  voiceDuration: number;
  alignmentPlan: AlignmentPlan | null;
  isAligning: boolean;

  // W4 矩阵交付与消重
  antiDupZoom: number;
  enableAmbientBlur: boolean;

  // 脏标记追踪
  dirtyState: DirtyState;

  // Actions
  setActiveWorkshop: (w: WorkshopKind) => void;
  setActiveTab: (t: WorkshopTab) => void;
  setSceneCuts: (cuts: WorkshopSceneCut[]) => void;
  setSubtitleSegments: (subs: SubtitleSegment[]) => void;
  setLlmProvider: (provider: string) => void;
  setScriptStyle: (style: "immersive" | "critic" | "story" | "roast") => void;
  setUserPrompt: (prompt: string) => void;
  setScriptText: (text: string) => void;
  setIsGeneratingScript: (generating: boolean) => void;
  setVoiceEngine: (engine: string) => void;
  setVoiceAudioPath: (path: string | null) => void;
  setVoiceDuration: (duration: number) => void;
  setAlignmentPlan: (plan: AlignmentPlan | null) => void;
  setIsAligning: (aligning: boolean) => void;
  setAntiDupZoom: (zoom: number) => void;
  setEnableAmbientBlur: (enabled: boolean) => void;
  setDirtyState: (updater: (prev: DirtyState) => DirtyState) => void;
  markDirty: (key: keyof DirtyState, value?: boolean) => void;
  resetAllDirty: () => void;
}

const initialDirtyState: DirtyState = {
  scenesDirty: false,
  scriptDirty: false,
  voiceDirty: false,
  timelineDirty: false,
  exportDirty: false,
};

export const useWorkshopStore = create<WorkshopState>((set) => ({
  activeWorkshop: "assets",
  activeTab: "agent",

  sceneCuts: [],
  subtitleSegments: [],

  llmProvider: "qwen",
  scriptStyle: "immersive",
  userPrompt: "",
  scriptText: "",
  isGeneratingScript: false,

  voiceEngine: "edge",
  voiceAudioPath: null,
  voiceDuration: 0,
  alignmentPlan: null,
  isAligning: false,

  antiDupZoom: 1.03,
  enableAmbientBlur: true,

  dirtyState: initialDirtyState,

  setActiveWorkshop: (activeWorkshop) => set({ activeWorkshop }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSceneCuts: (sceneCuts) => set({ sceneCuts }),
  setSubtitleSegments: (subtitleSegments) => set({ subtitleSegments }),
  setLlmProvider: (llmProvider) => set({ llmProvider }),
  setScriptStyle: (scriptStyle) => set({ scriptStyle }),
  setUserPrompt: (userPrompt) => set({ userPrompt }),
  setScriptText: (scriptText) => set({ scriptText }),
  setIsGeneratingScript: (isGeneratingScript) => set({ isGeneratingScript }),
  setVoiceEngine: (voiceEngine) => set({ voiceEngine }),
  setVoiceAudioPath: (voiceAudioPath) => set({ voiceAudioPath }),
  setVoiceDuration: (voiceDuration) => set({ voiceDuration }),
  setAlignmentPlan: (alignmentPlan) => set({ alignmentPlan }),
  setIsAligning: (isAligning) => set({ isAligning }),
  setAntiDupZoom: (antiDupZoom) => set({ antiDupZoom }),
  setEnableAmbientBlur: (enableAmbientBlur) => set({ enableAmbientBlur }),
  setDirtyState: (updater) =>
    set((state) => ({ dirtyState: updater(state.dirtyState) })),
  markDirty: (key, value = true) =>
    set((state) => ({
      dirtyState: { ...state.dirtyState, [key]: value },
    })),
  resetAllDirty: () => set({ dirtyState: initialDirtyState }),
}));
