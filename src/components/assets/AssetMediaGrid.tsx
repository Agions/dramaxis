import type { MediaFile } from "@dramaxis/ipc";
import { Badge, Card } from "@dramaxis/ui";
import { ThumbnailImage } from "@components/common/ThumbnailImage";

export interface AssetMediaGridProps {
  mediaList: MediaFile[];
  onRemoveMedia: (path: string) => void;
  onSelectMedia?: (media: MediaFile) => void;
}

export function AssetMediaGrid({
  mediaList,
  onRemoveMedia,
  onSelectMedia,
}: AssetMediaGridProps) {
  if (mediaList.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <span className="text-4xl">🎬</span>
        <h3 className="mt-3 text-sm font-bold text-text-primary">
          暂无匹配素材
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          点击上方按钮导入短剧切片或视频素材开始创作
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {mediaList.map((media) => {
        const durationSec = Math.round(media.duration_seconds || 0);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
        const fileName = media.path.split(/[/\\]/).pop() ?? media.path;

        return (
          <Card
            key={media.path}
            interactive
            onClick={() => onSelectMedia?.(media)}
            className="group relative flex flex-col overflow-hidden p-0"
          >
            {/* 缩略图容器 */}
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
              <ThumbnailImage
                source={media.path}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-200 backdrop-blur-sm">
                {timeStr}
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
                  className="rounded-lg p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition"
                  title="移除素材"
                >
                  🗑️
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
