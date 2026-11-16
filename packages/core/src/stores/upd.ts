/**
 * dramaxis v1.1.0 · update store (Zustand)
 *
 * 设计 (M4 完整实装):
 * - 镜像后端 UpdateState 完整快照 (单源真相)
 * - 当前端 listen `updater:event` 拿到 UpdateEvent 变体时,逐项投影覆盖
 * - 组件层只读快照,业务过渡态由 useUpdate hook 驱动
 *
 * 5 阶段状态机: idle → checking → available → downloading → ready
 */

import { create } from "zustand";
import type {
  UpdateInfo,
  UpdatePhase,
  UpdateProgress,
  UpdateState,
} from "@dramaxis/ipc";

interface UpdateStoreState {
  /** 完整状态快照(也写 currentVersion / downloadedPath / error) */
  snapshot: UpdateState;
  /** 已跳过的版本列表 */
  skippedVersions: string[];
  /** 是否存在未读新版本提示角标 */
  hasNotification: boolean;
  /** 便捷 setters,只覆盖单一字段 */
  setPhase: (phase: UpdatePhase) => void;
  setAvailable: (info: UpdateInfo | null) => void;
  setProgress: (progress: UpdateProgress | null) => void;
  setDownloadedPath: (path: string | null) => void;
  setError: (error: string | null) => void;
  setHasNotification: (val: boolean) => void;
  clearNotification: () => void;
  /** 跳过特定版本 */
  skipVersion: (version: string) => void;
  /** 全量替换(主要用于 listen 兜底事件) */
  setSnapshot: (snap: UpdateState) => void;
  /** 重置(用户取消 / 完成后清场) */
  reset: (currentVersion: string) => void;
}

const STORAGE_KEY = "dramaxis_skipped_versions";
const LEGACY_STORAGE_KEY = "splicr_skipped_versions";

function getInitialSkippedVersions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return JSON.parse(legacy);
    }
    return [];
  } catch {
    return [];
  }
}

const EMPTY: UpdateState = {
  phase: "idle",
  currentVersion: "",
  available: null,
  progress: null,
  error: null,
  downloadedPath: null,
};

export const useUpdateStore = create<UpdateStoreState>()((set) => ({
  snapshot: EMPTY,
  skippedVersions: getInitialSkippedVersions(),
  hasNotification: false,
  setPhase: (phase) =>
    set((s) => ({ snapshot: { ...s.snapshot, phase, error: null } })),
  setAvailable: (info) =>
    set((s) => {
      const isSkipped =
        info && s.skippedVersions.includes(info.version) && !info.isForce;
      return {
        snapshot: { ...s.snapshot, available: info },
        hasNotification: Boolean(info && !isSkipped),
      };
    }),
  setProgress: (progress) =>
    set((s) => ({ snapshot: { ...s.snapshot, progress } })),
  setDownloadedPath: (path) =>
    set((s) => ({ snapshot: { ...s.snapshot, downloadedPath: path } })),
  setError: (error) => set((s) => ({ snapshot: { ...s.snapshot, error } })),
  setHasNotification: (hasNotification) => set({ hasNotification }),
  clearNotification: () => set({ hasNotification: false }),
  skipVersion: (version) =>
    set((s) => {
      const updated = Array.from(new Set([...s.skippedVersions, version]));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return { skippedVersions: updated, hasNotification: false };
    }),
  setSnapshot: (snap) => set({ snapshot: snap }),
  reset: (currentVersion) =>
    set({
      snapshot: {
        ...EMPTY,
        currentVersion,
      },
    }),
}));
