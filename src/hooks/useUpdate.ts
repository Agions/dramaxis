/**
 * dramaxis v1.1.0 · 应用更新器 hook (M4 完整实装)
 *
 * 数据源:
 * - `updateIpc.getState()` 短轮询 (downloading/checking 时 500ms,其他 60s)
 * - `listen("updater:event")` 兜底 (后端 commands/update.rs 主动 emit 时触发 refetch)
 *
 * 暴露:
 * - state: 完整 UpdateState 快照
 * - check / download / install / reset 4 个动作
 * - busy: 仅 checking / downloading 为 true (UI 按钮 disabled 用)
 *
 * 状态机驱动: 5 阶段 (idle / checking / available / downloading / ready)
 */

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  updateIpc,
  type UpdateInstallResult,
  type UpdateState,
} from "@dramaxis/ipc";
import { useUpdateStore } from "@dramaxis/core";

export interface UseUpdateReturn {
  state: UpdateState;
  check: () => Promise<void>;
  silentCheck: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<UpdateInstallResult>;
  reset: () => Promise<void>;
  skipCurrentVersion: () => void;
  clearNotification: () => void;
  hasNotification: boolean;
  skippedVersions: string[];
  isForceUpdate: boolean;
  speedBps: number;
  remainingSeconds: number | null;
  busy: boolean;
}

export interface UseUpdateOptions {
  /** 当前版本号 - 注入到 store 的 currentVersion 字段 */
  currentVersion?: string;
}

export function useUpdate(opts: UseUpdateOptions = {}): UseUpdateReturn {
  const snapshot = useUpdateStore((s) => s.snapshot);
  const skippedVersions = useUpdateStore((s) => s.skippedVersions);
  const hasNotification = useUpdateStore((s) => s.hasNotification);
  const setSnapshot = useUpdateStore((s) => s.setSnapshot);
  const setAvailable = useUpdateStore((s) => s.setAvailable);
  const setPhase = useUpdateStore((s) => s.setPhase);
  const setDownloadedPath = useUpdateStore((s) => s.setDownloadedPath);
  const setError = useUpdateStore((s) => s.setError);
  const resetStore = useUpdateStore((s) => s.reset);
  const skipVersion = useUpdateStore((s) => s.skipVersion);
  const clearNotification = useUpdateStore((s) => s.clearNotification);

  // 拉取后端快照 (轮询 + listen 触发 refetch)
  const { refetch } = useQuery<UpdateState>({
    queryKey: ["update-state"],
    queryFn: async () => {
      try {
        const s = await updateIpc.getState();
        setSnapshot(s);
        return s;
      } catch (e) {
        // 网络/权限错误不阻塞 UI;仅记 error
        const msg = (e as { message?: string })?.message ?? String(e);
        setError(msg);
        throw e;
      }
    },
    refetchInterval: (q) => {
      const p = q.state.data?.phase;
      return p === "downloading" || p === "checking" ? 400 : 60_000;
    },
    staleTime: 0,
    retry: false,
  });

  // listen 兜底 (Tauri 端 `updater:event` 主动 emit)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let mounted = true;
    (async () => {
      try {
        const fn = await listen("updater:event", () => {
          if (mounted) void refetch();
        });
        if (!mounted) {
          fn();
        } else {
          unlisten = fn;
        }
      } catch (e) {
        // webview only: ignore
        console.debug("listen updater:event unavailable", e);
      }
    })();
    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [refetch]);

  // 初始化 currentVersion (通过 prop 注入,只执行一次)
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && opts.currentVersion) {
      resetStore(opts.currentVersion);
      initRef.current = true;
    }
  }, [opts.currentVersion, resetStore]);

  const check = useCallback(async () => {
    setError(null);
    try {
      const info = await updateIpc.check();
      setAvailable(info);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setError(msg);
    }
    void refetch();
  }, [setAvailable, setError, refetch]);

  const silentCheck = useCallback(async () => {
    try {
      const info = await updateIpc.check();
      setAvailable(info);
    } catch {
      // 静默检查吞掉异常
    }
  }, [setAvailable]);

  const download = useCallback(async () => {
    setError(null);
    try {
      const path = await updateIpc.download();
      setDownloadedPath(path);
      setPhase("ready");
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setError(msg);
    }
    void refetch();
  }, [setDownloadedPath, setError, setPhase, refetch]);

  const install = useCallback(async () => {
    try {
      return await updateIpc.install();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setError(msg);
      throw e;
    }
  }, [setError]);

  const reset = useCallback(async () => {
    try {
      await updateIpc.reset();
    } finally {
      resetStore(snapshot.currentVersion);
    }
  }, [resetStore, snapshot.currentVersion]);

  const skipCurrentVersion = useCallback(() => {
    if (snapshot.available?.version) {
      skipVersion(snapshot.available.version);
    }
  }, [snapshot.available?.version, skipVersion]);

  const busy =
    snapshot.phase === "checking" || snapshot.phase === "downloading";

  const isForceUpdate = Boolean(snapshot.available?.isForce);
  const speedBps = snapshot.progress?.speedBps ?? 0;
  const remainingSeconds = snapshot.progress?.remainingSeconds ?? null;

  return {
    state: snapshot,
    check,
    silentCheck,
    download,
    install,
    reset,
    skipCurrentVersion,
    clearNotification,
    hasNotification,
    skippedVersions,
    isForceUpdate,
    speedBps,
    remainingSeconds,
    busy,
  };
}
