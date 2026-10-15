/**
 * splicr v1.0.0 · AppShell
 * - TopBar + Sidebar + 内容区
 * - 主题初始化 (data-theme 同步到根节点)
 */

import { useEffect } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { useThemeStore, useSettingsStore } from "@dramaxis/core";
import { settingsIpc } from "@dramaxis/ipc";
import { useUpdate } from "@hooks/useUpdate";

export function AppShell() {
  const theme = useThemeStore((s) => s.theme);
  const { location } = useRouterState();
  const { silentCheck } = useUpdate();

  // 挂载时从桌面原生持久化配置 config.json 单向水合 settingsStore
  useEffect(() => {
    void (async () => {
      try {
        const snap = await settingsIpc.get();
        if (snap) {
          useSettingsStore.getState().syncFromSnapshot(snap);
        }
      } catch {
        // 非 Tauri / 测试环境静默回退
      }
    })();
  }, []);

  // 挂载时后台静默巡检新版本
  useEffect(() => {
    void silentCheck();
  }, [silentCheck]);

  // 同步主题到 <html data-theme="...">
  useEffect(() => {
    const root = document.documentElement;
    const effective =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    root.dataset.theme = effective;
  }, [theme]);

  return (
    <div
      className="flex h-screen flex-col"
      style={{
        background: "var(--color-bg)",
        color: "var(--color-text-primary)",
        transition: "background 200ms ease, color 200ms ease",
      }}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPath={location.pathname} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {/* 全局 ⌘K 命令面板 (cmdk) */}
      <CommandPalette />
    </div>
  );
}
