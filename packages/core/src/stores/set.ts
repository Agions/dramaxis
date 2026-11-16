/**
 * dramaxis v1.1.0 · settings store (Zustand)
 *
 * 架构规范:
 * - 确立 Tauri 后端 config.json 为唯一权威持久化源
 * - Zustand 仅作为内存响应式派发层，避免与 localStorage 双向覆盖冲突
 * - 提供 syncFromSnapshot 方法供应用启动/IPC变更时单向同步
 */

import { create } from "zustand";
import type {
  ConfigSnapshot,
  LlmProviderKind,
  TtsProviderKind,
} from "@dramaxis/ipc";

export interface SettingsState {
  locale: string;
  llmDefaultProvider: LlmProviderKind;
  ttsDefaultProvider: TtsProviderKind;
  autoSaveIntervalSec: number;
  initialized: boolean;
  setLocale: (locale: string) => void;
  setLlmDefault: (provider: LlmProviderKind) => void;
  setTtsDefault: (provider: TtsProviderKind) => void;
  setAutoSaveInterval: (sec: number) => void;
  syncFromSnapshot: (snapshot: Partial<ConfigSnapshot>) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  locale: "zh-CN",
  llmDefaultProvider: "open-ai",
  ttsDefaultProvider: "edge",
  autoSaveIntervalSec: 60,
  initialized: false,
  setLocale: (locale) => set({ locale }),
  setLlmDefault: (provider) => set({ llmDefaultProvider: provider }),
  setTtsDefault: (provider) => set({ ttsDefaultProvider: provider }),
  setAutoSaveInterval: (sec) => set({ autoSaveIntervalSec: sec }),
  syncFromSnapshot: (snapshot) =>
    set((prev) => ({
      ...prev,
      initialized: true,
      locale: snapshot.language ?? prev.locale,
      llmDefaultProvider:
        (snapshot.llm_provider as LlmProviderKind) ?? prev.llmDefaultProvider,
      ttsDefaultProvider:
        (snapshot.tts_provider as TtsProviderKind) ?? prev.ttsDefaultProvider,
    })),
}));
