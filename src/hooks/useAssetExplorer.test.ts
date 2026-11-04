import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAssetExplorer } from "./useAssetExplorer";
import { useProjectStore } from "@dramaxis/core";
import type { Project } from "@dramaxis/ipc";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@dramaxis/ipc", () => ({
  projectIpc: {
    listRecent: vi.fn().mockResolvedValue(["/path/to/recent.dramaxis"]),
    load: vi.fn().mockResolvedValue({
      path: "/path/to/recent.dramaxis",
      project: { id: "p1", name: "最近项目", media_files: [] },
    }),
  },
}));

vi.mock("@hooks/useAssets", () => ({
  useAssets: () => ({
    importFromPaths: vi.fn(),
    remove: vi.fn(),
    search: vi.fn().mockImplementation(async (all: string[], pat: string) =>
      all.filter((p) => p.includes(pat)),
    ),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: ["/path/to/recent.dramaxis"],
  }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

describe("useAssetExplorer", () => {
  const mockProject: Project = {
    id: "p-test",
    name: "测试短剧",
    created_at: "2026-11-04T00:00:00Z",
    updated_at: "2026-11-04T00:00:00Z",
    version: "1.2.0",
    settings: {
      resolution: "1080x1920",
      fps: 30,
      bitrate: "8000k",
      container: "mp4",
      codec: "libx264",
      four_strategy: "single",
    },
    media_files: [
      {
        path: "/media/clip1.mp4",
        duration_seconds: 15,
        resolution: "1080x1920",
        codec: "h264",
        file_size_bytes: 1048576,
        import_time: "2026-11-04T00:00:00Z",
      },
      {
        path: "/media/highlight.mp4",
        duration_seconds: 8,
        resolution: "1080x1920",
        codec: "h264",
        file_size_bytes: 2097152,
        import_time: "2026-11-04T00:00:00Z",
      },
    ],
    timeline: { tracks: [] },
    scripts: [],
    exports: [],
  };

  beforeEach(() => {
    useProjectStore.getState().setCurrentRecord("/path/to/project", mockProject);
  });

  it("正确派生当前工程中的媒体素材列表与数量统计", () => {
    const { result } = renderHook(() => useAssetExplorer());
    expect(result.current.totalCount).toBe(2);
    expect(result.current.displayedMedia.length).toBe(2);
  });

  it("通过 handleSearch 能够实时对媒体路径进行过滤", async () => {
    const { result } = renderHook(() => useAssetExplorer());

    await act(async () => {
      await result.current.handleSearch("highlight");
    });

    expect(result.current.displayedMedia.length).toBe(1);
    expect(result.current.displayedMedia[0]?.path).toBe("/media/highlight.mp4");

    // 清空搜索重置完整列表
    await act(async () => {
      await result.current.handleSearch("");
    });
    expect(result.current.displayedMedia.length).toBe(2);
  });
});
