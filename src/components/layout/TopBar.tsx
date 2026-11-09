/**
 * dramaxis v1.1.0 · 应用顶栏 — 电影调光室主题
 * - Logo（钢笔+播放键图标）+ 品牌名 + 版本
 * - 项目名称选择器（居中）
 * - Tauri 连接状态 + 设置入口
 * - 使用标准 Tailwind 样式体系，自动响应主题切换
 */

import { Link } from "@tanstack/react-router";
import { useTauriQuery } from "@hooks/useTauriQuery";
import { useUiStore, useSettingsStore, t } from "@dramaxis/core";
import { themeIpc } from "@dramaxis/ipc";
import { toast } from "sonner";
import { DramaxisLogo } from "@components/common/DramaxisLogo";

// TopBar 应用顶栏
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
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg p-0.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          title="Dramaxis 剧枢"
        >
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-gold/30 bg-surface shadow-[0_0_14px_var(--color-gold-glow)] transition-transform hover:scale-105">
            <DramaxisLogo size={24} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-black tracking-wide text-gold">
              Dramaxis
            </div>
            <div className="text-[10px] tracking-widest uppercase text-text-muted">
              剧枢 · v{version ?? "1.2.0"}
            </div>
          </div>
        </Link>
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
