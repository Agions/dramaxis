/**
 * dramaxis v1.3.0 · 媒体资产网格展示组件 (AssetMediaGrid)
 *
 * 核心升级:
 * - 电影级鼠标悬停动态滑擦审片 (Hover Scrubbing Preview)
 * - 统一采用 @dramaxis/ui 之 EmptyState / Card / Badge 原子组件
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { useState } from "react";
import type { MediaFile } from "@dramaxis/ipc";
import { Badge, Card, EmptyState } from "@dramaxis/ui";
import { ThumbnailImage } from "@components/common/thumb";

export interface AssetMediaGridProps {
  mediaList: MediaFile[];
  onRemoveMedia: (path: string) => void;
  onSelectMedia?: (media: MediaFile) => void;
}

function MediaAssetCard({
  media,
  onSelectMedia,
  onRemoveMedia,
}: {
  media: MediaFile;
  onSelectMedia?: (media: MediaFile) => void;
  onRemoveMedia: (path: string) => void;
}) {
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);

  const durationSec = Math.round(media.duration_seconds || 0);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const fileName = media.path.split(/[/\\]/).pop() ?? media.path;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setScrubPercent(ratio);
    }
  };

  const handleMouseLeave = () => {
    setScrubPercent(null);
  };

  const scrubTimeStr =
    scrubPercent !== null
      ? (() => {
          const s = Math.round(scrubPercent * durationSec);
          const m = Math.floor(s / 60);
          const sec = s % 60;
          return `${m}:${sec.toString().padStart(2, "0")}`;
        })()
      : null;

  return (
    <Card
      key={media.path}
      interactive
      onClick={() => onSelectMedia?.(media)}
      className="group relative flex flex-col overflow-hidden p-0"
    >
      {/* 缩略图容器 (支持悬停滑擦审片) */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative aspect-video w-full overflow-hidden bg-zinc-900 cursor-crosshair"
      >
        <ThumbnailImage
          source={media.path}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* 动态滑擦指针线与底边进度条 */}
        {scrubPercent !== null && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-gold shadow-[0_0_8px_#f5c842]"
              style={{ left: `${scrubPercent * 100}%` }}
            />
            <div
              className="absolute bottom-0 left-0 h-1 bg-gold shadow-[0_0_6px_#f5c842]"
              style={{ width: `${scrubPercent * 100}%` }}
            />
          </div>
        )}

        <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-200 backdrop-blur-sm">
          {scrubTimeStr ? `审片: ${scrubTimeStr}` : timeStr}
        </div>

        <div className="absolute top-2 left-2">
          <Badge variant="zinc" size="sm">
            {media.codec?.toUpperCase() || "H.264"}
          </Badge>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <h4 className="text-xs font-bold text-text-primary line-clamp-1 group-hover:text-gold transition-colors">
            {fileName}
          </h4>
          <p className="mt-0.5 text-[10px] text-text-secondary truncate font-mono">
            {media.path}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-text-secondary">
          <span>{media.resolution ?? "自动识别"}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveMedia(media.path);
            }}
            className="rounded-lg p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition cursor-pointer"
            title="移除素材"
          >
            🗑️
          </button>
        </div>
      </div>
    </Card>
  );
}

export function AssetMediaGrid({
  mediaList,
  onRemoveMedia,
  onSelectMedia,
}: AssetMediaGridProps) {
  if (mediaList.length === 0) {
    return (
      <EmptyState
        icon="🎬"
        title="暂无匹配素材"
        description="点击上方按钮导入短剧切片或视频素材开始创作"
        className="min-h-[300px]"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {mediaList.map((media) => (
        <MediaAssetCard
          key={media.path}
          media={media}
          onSelectMedia={onSelectMedia}
          onRemoveMedia={onRemoveMedia}
        />
      ))}
    </div>
  );
}
