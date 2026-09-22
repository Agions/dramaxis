/**
 * splicr v1.0.1 · 缩略图通用纯 UI 组件
 *
 * 规范设计:
 * - 纯展示型组件，不依赖业务层 hooks
 * - 支持外部注入 fetchThumbnail 异步加载函数或直接传入 thumbnailUrl
 * - 占位符: 加载前/失败时显示 kind 图标 + 文件名尾部
 */

import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { basename } from "@splicr/utils";

export interface ThumbnailImageProps {
  /** 素材源路径 */
  source: string;
  /** 素材类型 (决定占位图标) */
  kind?: "video" | "audio" | "image" | "subtitle" | "other";
  /** 缩略图宽度 (默认 240) */
  width?: number;
  /** CSS class */
  className?: string;
  /** alt 文本 (默认取文件 basename) */
  alt?: string;
  /** 直接传入的缩略图文件路径或 URL (可选) */
  thumbnailUrl?: string | null;
  /** 异步缩略图生成/提取委托函数 (可选) */
  fetchThumbnail?: (source: string, width: number) => Promise<{ thumbnailPath: string }>;
}

const KIND_ICON: Record<string, string> = {
  video: "🎞",
  audio: "🎵",
  image: "🖼",
  subtitle: "💬",
  other: "📄",
};

const KIND_TONE: Record<string, string> = {
  video: "bg-blue-950/60 text-blue-300",
  audio: "bg-violet-950/60 text-violet-300",
  image: "bg-emerald-950/60 text-emerald-300",
  subtitle: "bg-amber-950/60 text-amber-300",
  other: "bg-zinc-800 text-zinc-400",
};

export function ThumbnailImage({
  source,
  kind = "other",
  width = 240,
  className,
  alt,
  thumbnailUrl,
  fetchThumbnail,
}: ThumbnailImageProps) {
  const [thumbPath, setThumbPath] = useState<string | null>(thumbnailUrl ?? null);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    thumbnailUrl ? "ready" : fetchThumbnail ? "loading" : "ready"
  );

  useEffect(() => {
    if (thumbnailUrl) {
      setThumbPath(thumbnailUrl);
      setState("ready");
      return;
    }

    if (!fetchThumbnail) {
      setThumbPath(null);
      setState("ready");
      return;
    }

    let cancelled = false;
    setThumbPath(null);
    setState("loading");
    fetchThumbnail(source, width)
      .then((res) => {
        if (cancelled) return;
        setThumbPath(res.thumbnailPath);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [source, width, thumbnailUrl, fetchThumbnail]);

  const tail = (alt ?? basename(source)).trim();
  const placeholderIcon = KIND_ICON[kind] ?? "📄";
  const placeholderTone = KIND_TONE[kind] ?? KIND_TONE.other;

  return (
    <div
      className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg ${placeholderTone} ${className ?? ""}`}
      aria-label={tail}
    >
      {state === "ready" && thumbPath ? (
        <img
          src={convertFileSrc(thumbPath)}
          alt={tail}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-3xl leading-none">{placeholderIcon}</div>
          <div className="line-clamp-2 max-w-[90%] text-center font-mono text-[10px] text-current/70">
            {tail}
          </div>
          {state === "loading" && (
            <div className="text-[10px] opacity-60">生成缩略图...</div>
          )}
          {state === "error" && (
            <div className="text-[10px] opacity-60">无法生成</div>
          )}
        </div>
      )}
    </div>
  );
}
