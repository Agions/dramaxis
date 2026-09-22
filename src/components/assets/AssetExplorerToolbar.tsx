export interface AssetExplorerToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onImportMedia: () => void;
  onOpenBatchDialog: () => void;
  mediaCount: number;
}

export function AssetExplorerToolbar({
  searchQuery,
  onSearchChange,
  onImportMedia,
  onOpenBatchDialog,
  mediaCount,
}: AssetExplorerToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <div className="relative flex-1">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
          🔍
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`在 ${mediaCount} 个素材中按文件名或路径搜索...`}
          className="w-full rounded-xl border border-border bg-surface-elevated py-2 pl-9 pr-3 text-xs text-text-primary placeholder-text-secondary focus:border-gold focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBatchDialog}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-bold text-text-primary transition hover:border-gold active:scale-95"
        >
          📂 批量目录扫描
        </button>
        <button
          type="button"
          onClick={onImportMedia}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-[0_0_15px_var(--color-gold-glow)] transition hover:scale-[1.02] active:scale-95"
        >
          ➕ 导入视频素材
        </button>
      </div>
    </div>
  );
}
