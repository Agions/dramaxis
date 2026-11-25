/**
 * dramaxis · assets/studio.tsx · 工作室 NAS 路径重映射与跨集台词 FTS 检索面板 (P2-2)
 */

import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  projectIpc,
  type PathMappingRule,
  type ScriptSegmentHit,
} from "@dramaxis/ipc";
import { useProject } from "@hooks/project";

export function StudioToolsPanel() {
  const { project, currentPath, open } = useProject();

  // FTS 全文检索状态
  const [ftsQuery, setFtsQuery] = useState("");
  const [ftsHits, setFtsHits] = useState<ScriptSegmentHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // NAS 路径重映射状态
  const [fromPrefix, setFromPrefix] = useState("/Volumes/Share");
  const [toPrefix, setToPrefix] = useState("Z:\\Share");
  const [candidateRoot, setCandidateRoot] = useState("");
  const [isRemapping, setIsRemapping] = useState(false);

  const handleFtsSearch = async () => {
    const q = ftsQuery.trim();
    if (!q) {
      toast.error("请输入台词或黄金 Hook 关键词");
      return;
    }
    setIsSearching(true);
    try {
      const hits = await projectIpc.searchScriptSegments(
        q,
        null,
        30,
        currentPath ?? null,
      );
      setFtsHits(hits);
      if (hits.length === 0) {
        toast.info("未检索到匹配的台词或 Hook 片段");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("台词检索失败", {
        description: err?.message ?? String(e),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidateRoot = async () => {
    const selected = await openDialog({
      title: "选择当前机器上的本地 / NAS 素材根目录",
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setCandidateRoot(selected);
    }
  };

  const handleRemapNas = async () => {
    if (!project || !currentPath) {
      toast.error("请先打开一个工程再执行 NAS 路径重映射");
      return;
    }
    setIsRemapping(true);
    try {
      const rules: PathMappingRule[] =
        fromPrefix.trim() && toPrefix.trim()
          ? [{ fromPrefix: fromPrefix.trim(), toPrefix: toPrefix.trim() }]
          : [];
      const roots = candidateRoot.trim() ? [candidateRoot.trim()] : [];
      const updated = await projectIpc.remapNasPaths(project, rules, roots);
      await projectIpc.save(currentPath, updated);
      await open(currentPath);
      toast.success("NAS 路径重映射与工程保存完成");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("NAS 重映射失败", {
        description: err?.message ?? String(e),
      });
    } finally {
      setIsRemapping(false);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
      {/* 跨工程台词 / Hook FTS 检索 */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <span>🔍</span>
              <span>跨工程台词 & 黄金 Hook 检索</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              基于 SQLite FTS 秒级检索历史分集台词、高能钩子与情绪标记
            </p>
          </div>
          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-text-muted">
            FTS
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={ftsQuery}
            onChange={(e) => setFtsQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleFtsSearch();
            }}
            placeholder="输入台词关键词，如：退婚、龙神、首富..."
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-primary"
          />
          <button
            type="button"
            disabled={isSearching}
            onClick={() => void handleFtsSearch()}
            className="rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 px-3.5 py-1.5 text-xs font-bold text-gold transition-all disabled:opacity-50"
          >
            {isSearching ? "检索中..." : "全文检索"}
          </button>
        </div>

        {ftsHits.length > 0 && (
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {ftsHits.map((hit) => (
              <div
                key={`${hit.projectId}-${hit.segmentId}`}
                className="rounded-lg border border-white/5 bg-black/25 p-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-amber-300 truncate">
                    {hit.projectId}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hit.isHook && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] text-red-300">
                        🔥 Hook
                      </span>
                    )}
                    {hit.emotion && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-text-muted">
                        {hit.emotion}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-text-primary leading-relaxed">
                  {hit.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 工作室 NAS 路径重映射 */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <span>🗄️</span>
              <span>工作室 NAS 跨平台路径重映射</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              解决 macOS / Windows 多机挂载同一 NAS 时工程素材脱机问题
            </p>
          </div>
          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-text-muted">
            {project ? project.name : "未打开工程"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-text-muted">
              原前缀 (From Prefix)
            </label>
            <input
              type="text"
              value={fromPrefix}
              onChange={(e) => setFromPrefix(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-text-muted">
              目标前缀 (To Prefix)
            </label>
            <input
              type="text"
              value={toPrefix}
              onChange={(e) => setToPrefix(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={candidateRoot}
            onChange={(e) => setCandidateRoot(e.target.value)}
            placeholder="候选自动寻址根目录 (可选)..."
            className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary"
          />
          <button
            type="button"
            onClick={() => void handleSelectCandidateRoot()}
            className="rounded-lg border border-border bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-text-primary"
          >
            选目录
          </button>
          <button
            type="button"
            disabled={isRemapping || !project}
            onClick={() => void handleRemapNas()}
            className="rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3.5 py-1.5 text-xs font-bold text-indigo-200 transition-all disabled:opacity-50"
          >
            {isRemapping ? "重映射中..." : "一键重定位"}
          </button>
        </div>
      </div>
    </section>
  );
}
