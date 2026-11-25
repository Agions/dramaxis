/**
 * dramaxis · export/pro.tsx · 专业 NLE 交接 (FCPXML 1.10) 与创作者资产模板包 (.dramaxis-pack)
 *
 * 将后端 P2-3 的 `export_fcpxml_timeline` / `export_template_pack` / `import_template_pack`
 * 能力接入导出工坊。
 */

import { memo } from "react";

export interface ProExportCardProps {
  isExportingFcpxml: boolean;
  exportedFcpxmlPath: string | null;
  onExportFcpxml: () => void;
  onOpenFcpxmlFolder: (path: string) => void;
  isExportingPack: boolean;
  isImportingPack: boolean;
  importedPackName: string | null;
  onExportPack: () => void;
  onImportPack: () => void;
}

export const ProExportCard = memo(function ProExportCard({
  isExportingFcpxml,
  exportedFcpxmlPath,
  onExportFcpxml,
  onOpenFcpxmlFolder,
  isExportingPack,
  isImportingPack,
  importedPackName,
  onExportPack,
  onImportPack,
}: ProExportCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <span>🎞️</span>
            <span>专业 NLE 交接 & 创作者资产包</span>
          </h4>
          <p className="text-[10px] text-text-muted mt-0.5">
            导出标准 FCPXML 1.10 至 DaVinci / Final Cut / Premiere，或复用工作室模板包
          </p>
        </div>
        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-semibold text-indigo-300 border border-indigo-500/30">
          FCPXML + Pack
        </span>
      </div>

      {/* FCPXML 1.10 导出区 */}
      <div className="rounded-lg border border-white/5 bg-black/25 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-text-primary">
              FCPXML 1.10 五轨时间线工程
            </div>
            <div className="text-[10px] text-text-muted truncate">
              包含 V1 画面、A1 旁白、A2 环境声、A3 BGM 与 S1 字幕轨
            </div>
          </div>
          <button
            type="button"
            disabled={isExportingFcpxml}
            onClick={onExportFcpxml}
            className="shrink-0 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3 py-1.5 text-[11px] font-bold text-indigo-200 transition-all disabled:opacity-50"
          >
            {isExportingFcpxml ? "生成中..." : "导出 .fcpxml"}
          </button>
        </div>

        {exportedFcpxmlPath && (
          <div className="flex items-center justify-between gap-2 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px]">
            <span className="truncate text-emerald-300 font-mono">
              {exportedFcpxmlPath}
            </span>
            <button
              type="button"
              onClick={() => onOpenFcpxmlFolder(exportedFcpxmlPath)}
              className="shrink-0 text-emerald-200 underline hover:text-white"
            >
              定位文件
            </button>
          </div>
        )}
      </div>

      {/* .dramaxis-pack 模板包区 */}
      <div className="rounded-lg border border-white/5 bg-black/25 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-text-primary">
              创作者资产模板包 (.dramaxis-pack)
            </div>
            <div className="text-[10px] text-text-muted truncate">
              打包/导入文案 Prompt、黄金 Hook、花字样式与母带消重预设
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isImportingPack}
              onClick={onImportPack}
              className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 px-2.5 py-1.5 text-[10px] font-semibold text-text-primary transition-all disabled:opacity-50"
            >
              {isImportingPack ? "导入中..." : "导入包"}
            </button>
            <button
              type="button"
              disabled={isExportingPack}
              onClick={onExportPack}
              className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 transition-all disabled:opacity-50"
            >
              {isExportingPack ? "打包中..." : "导出包"}
            </button>
          </div>
        </div>

        {importedPackName && (
          <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
            已应用模板包：{importedPackName}
          </div>
        )}
      </div>
    </div>
  );
});
