/**
 * dramaxis v1.1.0 · 项目与资产管理中心 (深度模块化与组件化架构)
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  projectIpc,
  type MediaFile,
  type Project,
  type ProjectRecord,
} from "@dramaxis/ipc";
import { useAssets } from "@hooks/useAssets";
import { useProjectStore, useSettingsStore, t } from "@dramaxis/core";
import { BatchImportDialog } from "@components/dialogs/BatchImportDialog";
import { AssetExplorerToolbar } from "@components/assets/AssetExplorerToolbar";
import { AssetMediaGrid } from "@components/assets/AssetMediaGrid";
import { toast } from "sonner";

export const Route = createFileRoute("/assets")({
  component: AssetsPage,
});

function AssetsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const locale = useSettingsStore((s) => s.locale);
  const setCurrentRecord = useProjectStore((s) => s.setCurrentRecord);
  const storeProject = useProjectStore((s) => s.current);

  const { data: recents } = useQuery({
    queryKey: ["assets-recent"],
    queryFn: projectIpc.listRecent,
  });

  const cachedRaw = qc.getQueryData<ProjectRecord | null>(["current-project"]);
  const current: Project | null = useMemo(() => {
    return storeProject ?? cachedRaw?.project ?? null;
  }, [storeProject, cachedRaw]);

  useEffect(() => {
    if (!current && recents && recents.length > 0 && recents[0]) {
      void projectIpc.load(recents[0]).then((rec) => {
        setCurrentRecord(rec.path, rec.project);
        qc.setQueryData(["current-project"], rec);
        qc.setQueryData(["assets-current-project"], rec.project);
      });
    }
  }, [current, recents, setCurrentRecord, qc]);

  const { importFromPaths, remove: removeAssets, search } = useAssets();
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [matchingPaths, setMatchingPaths] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleImportMedia = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "视频素材 (Video)",
            extensions: ["mp4", "mov", "avi", "mkv", "webm"],
          },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await importFromPaths(paths);
      toast.success(`成功导入 ${paths.length} 个视频文件`);
    } catch (e) {
      toast.error("导入素材失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleRemoveMedia = async (idOrPath: string) => {
    try {
      await removeAssets([idOrPath]);
      toast.success("已移除素材");
    } catch (e) {
      toast.error("移除素材失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleSearch = async (pattern: string) => {
    setSearchQuery(pattern);
    if (!pattern.trim() || !current) {
      setMatchingPaths(null);
      return;
    }
    try {
      const all = current.media_files.map((m) => m.path);
      const filtered = await search(all, pattern.trim());
      setMatchingPaths(filtered);
    } catch {
      setMatchingPaths(null);
    }
  };

  const handleCreateBlank = async () => {
    try {
      const rec = await projectIpc.createBlank();
      setCurrentRecord(rec.path, rec.project);
      qc.setQueryData(["assets-current-project"], rec.project);
      qc.setQueryData(["current-project"], rec);
      void qc.invalidateQueries({ queryKey: ["assets-recent"] });
      toast.success(`已创建空白解说工程: ${rec.project.name}`);
      void navigate({ to: "/production" });
    } catch (e) {
      toast.error("创建空白项目失败", { description: String(e) });
    }
  };

  const filteredMedia = useMemo<MediaFile[]>(() => {
    if (!matchingPaths) return current?.media_files ?? [];
    const set = new Set(matchingPaths);
    return (current?.media_files ?? []).filter((m) => set.has(m.path));
  }, [current?.media_files, matchingPaths]);

  return (
    <div className="h-full w-full overflow-y-auto bg-bg p-6 md:p-8 select-none font-sans">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* 顶栏 */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-text-primary">
              {t("assets.title", locale)}
            </h1>
            <p className="text-xs text-text-secondary">
              管理多模态解说工程、高清媒体素材、AI 脚本与渲染导出库
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateBlank}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber px-5 py-2.5 text-xs font-black text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95"
          >
            <span>✨</span>
            <span>{t("action.create", locale)}</span>
          </button>
        </header>

        {/* 搜索与工具栏 */}
        <AssetExplorerToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onImportMedia={handleImportMedia}
          onOpenBatchDialog={() => setShowBatchDialog(true)}
          mediaCount={current?.media_files?.length ?? 0}
        />

        {/* 媒体素材网格 */}
        <AssetMediaGrid
          mediaList={filteredMedia}
          onRemoveMedia={handleRemoveMedia}
        />

        {/* 历史项目归档 */}
        {recents && recents.length > 0 && (
          <section className="space-y-3 pt-4">
            <h2 className="text-sm font-bold text-text-primary">
              历史项目归档 (Recent Projects)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {recents.map((path) => {
                const segments = path.split(/[/\\]/);
                let last = segments.pop() || path;
                if (last === "project.dramaxis.json" && segments.length > 0) {
                  last = segments.pop() || last;
                }
                const name =
                  last.replace(/\.(dramaxis|splicr)(\.json)?$/, "") || last;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      void projectIpc.load(path).then((rec) => {
                        setCurrentRecord(rec.path, rec.project);
                        qc.setQueryData(
                          ["assets-current-project"],
                          rec.project,
                        );
                        qc.setQueryData(["current-project"], rec);
                        void navigate({ to: "/production" });
                      });
                    }}
                    className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 text-left transition hover:border-gold/60 active:scale-[0.99]"
                  >
                    <div className="text-xs font-bold text-text-primary truncate">
                      {name}
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-text-secondary truncate">
                      {path}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <BatchImportDialog
          open={showBatchDialog}
          onClose={() => setShowBatchDialog(false)}
        />
      </div>
    </div>
  );
}
