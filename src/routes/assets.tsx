/**
 * dramaxis v1.2.0 · 项目与资产管理中心 (领域驱动与声明式装配架构)
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectIpc } from "@dramaxis/ipc";
import { useProject } from "@hooks/useProject";
import { useAssetExplorer } from "@hooks/useAssetExplorer";
import { useSettingsStore, t } from "@dramaxis/core";
import { BatchImportDialog } from "@components/dialogs/BatchImportDialog";
import { AssetExplorerToolbar } from "@components/assets/AssetExplorerToolbar";
import { AssetMediaGrid } from "@components/assets/AssetMediaGrid";
import { toast } from "sonner";

export const Route = createFileRoute("/assets")({
  component: AssetsPage,
});

function AssetsPage() {
  const navigate = useNavigate();
  const locale = useSettingsStore((s) => s.locale);
  const { open, createBlank } = useProject();

  const {
    displayedMedia,
    totalCount,
    searchQuery,
    showBatchDialog,
    setShowBatchDialog,
    handleSearch,
    handleImportMedia,
    handleRemoveMedia,
  } = useAssetExplorer();

  const { data: recents } = useQuery({
    queryKey: ["assets-recent"],
    queryFn: projectIpc.listRecent,
  });

  const handleCreateBlank = async () => {
    try {
      const rec = await createBlank();
      toast.success(`已创建空白解说工程: ${rec.project.name}`);
      void navigate({ to: "/production" });
    } catch (e) {
      toast.error("创建空白项目失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      await open(path);
      void navigate({ to: "/production" });
    } catch (e) {
      toast.error("加载项目失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

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
          mediaCount={totalCount}
        />

        {/* 媒体素材网格 */}
        <AssetMediaGrid
          mediaList={displayedMedia}
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
                    onClick={() => void handleOpenRecent(path)}
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
