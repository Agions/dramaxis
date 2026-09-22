/**
 * splicr v1.0.0 · 应用顶栏 — 电影调光室主题
 * - Logo（钢笔+播放键图标）+ 品牌名 + 版本
 * - 项目名称选择器（居中）
 * - Tauri 连接状态 + 设置入口
 * - 使用标准 Tailwind 样式体系，自动响应主题切换
 */

import { Link } from "@tanstack/react-router";
import { useTauriQuery } from "@hooks/useTauriQuery";
import { useUiStore, useSettingsStore, t } from "@splicr/core";
import { themeIpc } from "@splicr/ipc";
import { toast } from "sonner";

// splicr Logo 图标 SVG（钢笔笔尖 + 播放三角，内联）
function SplicrIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="splicr Logo"
    >
      <defs>
        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-gold)" />
          <stop offset="100%" stopColor="var(--color-amber)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* 钢笔笔尖 */}
      <path
        d="M6 16 L13 9 L16 12 L11 20 Z"
        fill="url(#gold-grad)"
        filter="url(#glow)"
        opacity="0.9"
      />
      <circle cx="10" cy="16" r="1.2" fill="var(--color-bg)" />
      {/* 播放三角 */}
      <path
        d="M14 10 L26 16 L14 22 Z"
        fill="url(#gold-grad)"
        filter="url(#glow)"
      />
    </svg>
  );
}

export function TopBar() {
  const { data: version, isError } = useTauriQuery({
    command: "app_version",
    queryKeyPrefix: "topbar-version",
    args: {},
  });
  const openPalette = useUiStore((s) => s.openCommandPalette);
  const { locale, setLocale } = useSettingsStore();
  const connected = !isError && Boolean(version);

  return (
    <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md z-50 [app-region:drag]">
      {/* 左侧：Logo + 品牌名 */}
      <div className="flex items-center gap-2.5 [app-region:no-drag]">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-surface shadow-[0_0_12px_var(--color-gold-glow)]">
          <SplicrIcon size={22} />
        </div>
        <div className="leading-tight">
          <div className="text-base font-bold tracking-wide text-gold">
            splicr
          </div>
          <div className="text-[10px] tracking-widest uppercase text-text-muted">
            叙影 · v{version ?? "1.0.1"}
          </div>
        </div>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex items-center gap-2 [app-region:no-drag]">
        {/* 搜索命令 */}
        <button
          type="button"
          id="topbar-cmd-palette"
          onClick={() => openPalette()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-gold hover:text-gold cursor-pointer"
          title={t("topbar.search_title", locale)}
        >
          <span>🔍</span>
          <span>{t("topbar.search_placeholder", locale)}</span>
          <kbd className="ml-1 rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            ⌘K
          </kbd>
        </button>

        {/* 语言切换按钮 (中/英) */}
        <button
          type="button"
          onClick={async () => {
            const nextLoc = locale === "en-US" ? "zh-CN" : "en-US";
            setLocale(nextLoc);
            try {
              await themeIpc.setLocale(nextLoc);
            } catch {
              // fallback
            }
            toast.success(
              nextLoc === "en-US" ? "Language: English" : "语言：简体中文",
            );
          }}
          title="切换中英文 (Toggle Language)"
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-primary hover:border-gold transition-colors cursor-pointer"
        >
          <span>{locale === "en-US" ? "🇺🇸 EN" : "🇨🇳 中"}</span>
        </button>

        {/* 后端连接状态 */}
        <div
          id="topbar-connection-status"
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            connected
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
              : "border-red-400/25 bg-red-400/10 text-red-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
            }`}
          />
          {connected
            ? t("topbar.connected", locale)
            : t("topbar.disconnected", locale)}
        </div>

        {/* 设置按钮 */}
        <Link
          to="/settings"
          id="topbar-settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-sm text-text-muted transition-colors hover:border-gold hover:text-gold cursor-pointer"
          title={t("nav.settings", locale)}
        >
          ⚙️
        </Link>
      </div>
    </header>
  );
}
