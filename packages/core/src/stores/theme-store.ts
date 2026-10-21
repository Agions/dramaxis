/**
 * dramaxis v1.1.0 · theme store (Zustand)
 *
 * 架构规范:
 * - 统一管理 light / dark / system 模式
 * - 修复 system 模式下 toggle 无法识别真实系统外观的缺陷
 * - 提供 safeStorage 兜底环境无 localStorage 时的异常，自动兼容旧版 storage key
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

export function getEffectiveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ) {
      return "dark";
    }
    return "light";
  }
  return theme;
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = "dramaxis.theme";
const LEGACY_STORAGE_KEY = "splicr.theme";

const safeStorage = {
  getItem: (name: string) => {
    try {
      if (
        typeof localStorage !== "undefined" &&
        typeof localStorage.getItem === "function"
      ) {
        const val = localStorage.getItem(name);
        if (val !== null) return val;
        if (name === STORAGE_KEY) {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy !== null) {
            localStorage.setItem(STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return legacy;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      if (
        typeof localStorage !== "undefined" &&
        typeof localStorage.setItem === "function"
      ) {
        localStorage.setItem(name, value);
      }
    } catch {
      // ignore
    }
  },
  removeItem: (name: string) => {
    try {
      if (
        typeof localStorage !== "undefined" &&
        typeof localStorage.removeItem === "function"
      ) {
        localStorage.removeItem(name);
      }
    } catch {
      // ignore
    }
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggle: () => {
        const effective = getEffectiveTheme(get().theme);
        set({ theme: effective === "dark" ? "light" : "dark" });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
