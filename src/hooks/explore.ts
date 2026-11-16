/**
 * dramaxis v1.2.0 · useAssetExplorer
 *
 * 资产探索器领域 Hook:
 * - 统一聚合项目当前素材状态与 useProject / useAssets 领域能力
 * - 自动自愈/对齐当前项目，消除跨页面 queryCache 与 store 双脑分裂
 * - 集中管控素材检索过滤、本地单/多视频导入、素材批量移除与 BatchDialog 显隐状态
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectIpc, type MediaFile, type Project } from "@dramaxis/ipc";
import { useAssets } from "@hooks/useAssets";
import { useProject } from "@hooks/useProject";
import { useProjectStore } from "@dramaxis/core";

export interface UseAssetExplorerReturn {
  currentProject: Project | null;
  displayedMedia: MediaFile[];
  totalCount: number;
  searchQuery: string;
  isSearching: boolean;
  showBatchDialog: boolean;
  setShowBatchDialog: (open: boolean) => void;
  handleSearch: (pattern: string) => Promise<void>;
  handleImportMedia: () => Promise<void>;
  handleRemoveMedia: (idOrPath: string) => Promise<void>;
}

export function useAssetExplorer(): UseAssetExplorerReturn {
  const { open } = useProject();
  const currentProject = useProjectStore((s) => s.current);
  const { importFromPaths, remove: removeAssets, search } = useAssets();

  const { data: recents } = useQuery({
    queryKey: ["assets-recent"],
    queryFn: projectIpc.listRecent,
  });

  // 项目自初始化: 无打开工程时自动恢复最近工程
  useEffect(() => {
    if (!currentProject && recents && recents.length > 0 && recents[0]) {
      void open(recents[0]);
    }
  }, [currentProject, recents, open]);

  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [matchingPaths, setMatchingPaths] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (pattern: string) => {
      setSearchQuery(pattern);
      if (!pattern.trim() || !currentProject) {
        setMatchingPaths(null);
        return;
      }
      setIsSearching(true);
      try {
        const allPaths = currentProject.media_files.map((m) => m.path);
        const filtered = await search(allPaths, pattern.trim());
        setMatchingPaths(filtered);
      } catch (e) {
        toast.error("检索素材失败", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setIsSearching(false);
      }
    },
    [currentProject, search],
  );

  const handleImportMedia = useCallback(async () => {
    try {
      const selected = await openDialog({
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
  }, [importFromPaths]);

  const handleRemoveMedia = useCallback(
    async (idOrPath: string) => {
      try {
        await removeAssets([idOrPath]);
        toast.success("已移除素材");
      } catch (e) {
        toast.error("移除素材失败", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [removeAssets],
  );

  const displayedMedia: MediaFile[] = useMemo(() => {
    if (!currentProject) return [];
    if (!matchingPaths) return currentProject.media_files;
    return currentProject.media_files.filter((m) =>
      matchingPaths.includes(m.path),
    );
  }, [currentProject, matchingPaths]);

  return {
    currentProject,
    displayedMedia,
    totalCount: currentProject?.media_files?.length ?? 0,
    searchQuery,
    isSearching,
    showBatchDialog,
    setShowBatchDialog,
    handleSearch,
    handleImportMedia,
    handleRemoveMedia,
  };
}
