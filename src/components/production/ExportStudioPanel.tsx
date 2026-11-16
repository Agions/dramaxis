/**
 * dramaxis v1.2.0 · ExportStudioPanel (Facade Re-export)
 *
 * 拆分后保留此门面导出，确保向后完全兼容已有页面和测试。
 * 具体实现请参见:
 * - ./export/index.tsx (面板组装)
 * - ./export/draft.tsx (剪映原生草稿导出)
 * - ./export/master.tsx (多平台母带与消重矩阵)
 * - ./export/render.tsx (多平台直接渲染与硬件加速)
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

export {
  ExportStudioPanel,
  type ExportStudioPanelProps,
  CapcutDraftCard,
  MasteringOptionsCard,
  DedupMatrixCard,
  PlatformRenderCard,
} from "./export";
