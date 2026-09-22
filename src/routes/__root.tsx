/**
 * splicr v1.0.0 · 根路由 (M3.2 · 接 AppShell)
 *
 * 整个应用统一布局:AppShell 已经包含 TopBar + Sidebar + 自带 Outlet。
 */

import {
  HeadContent,
  Link,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppShell } from "@components/layout/AppShell";
import { ErrorBoundary } from "@splicr/ui";
import { useThemeStore } from "@splicr/core";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="space-y-3 text-center">
        <h1 className="bg-gradient-to-br from-blue-400 to-fuchsia-500 bg-clip-text text-5xl font-black text-transparent">
          404
        </h1>
        <p className="text-zinc-400">页面不存在 · Page not found</p>
        <Link to="/" className="text-blue-400 hover:underline">
          返回首页
        </Link>
      </div>
    </div>
  ),
});

function RootLayout() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <>
      <HeadContent />
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
      <Toaster
        theme={theme === "light" ? "light" : "dark"}
        position="bottom-center"
        closeButton
        visibleToasts={5}
        toastOptions={{
          duration: 12000,
          classNames: {
            toast:
              "!bg-surface !text-text-primary !border-2 !border-gold !rounded-2xl !px-6 !py-4 !shadow-[0_10px_36px_var(--color-gold-glow)] !backdrop-blur-2xl !text-xs !font-bold !mb-6",
            title: "!text-sm !font-extrabold !text-text-primary",
            description: "!text-xs !text-text-secondary !mt-1",
            closeButton:
              "!bg-gold !text-zinc-950 !border-none hover:!scale-110 !transition-transform",
          },
        }}
      />
    </>
  );
}
