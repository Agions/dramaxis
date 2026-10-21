/**
 * dramaxis v1.1.0 · 5 轨多媒体时间轴视口虚拟化裁剪算法
 */

export interface VirtualViewportOptions {
  /** 时间轴可视区宽度 (px) */
  containerWidth: number;
  /** 当前滚动位移 (px) */
  scrollLeft: number;
  /** 像素每秒比例 (px/s) */
  zoomLevel: number;
  /** 视口左右预渲染缓冲区 (秒) */
  bufferSeconds?: number;
}

export interface VisibleTimeRange {
  startSeconds: number;
  endSeconds: number;
}

export interface TimelineClipItem {
  id: string;
  start_seconds: number;
  in_seconds: number;
  out_seconds: number;
}

/**
 * 根据容器宽度与滚动偏移，计算当前可视的时间区间
 */
export function calculateVisibleTimeRange({
  containerWidth,
  scrollLeft,
  zoomLevel,
  bufferSeconds = 2.0,
}: VirtualViewportOptions): VisibleTimeRange {
  const safeZoom = Math.max(zoomLevel, 1);
  const startSeconds = Math.max(0, scrollLeft / safeZoom - bufferSeconds);
  const endSeconds = (scrollLeft + containerWidth) / safeZoom + bufferSeconds;

  return { startSeconds, endSeconds };
}

/**
 * 筛选位于当前可视区间内的片段 (用于时间轴 Canvas/DOM 虚拟化裁剪)
 */
export function filterVisibleClips<T extends TimelineClipItem>(
  clips: T[],
  range: VisibleTimeRange,
): T[] {
  return clips.filter((clip) => {
    const clipDuration = Math.max(0, clip.out_seconds - clip.in_seconds);
    const clipEnd = clip.start_seconds + clipDuration;
    // 片段与视口存在交集
    return (
      clipEnd >= range.startSeconds && clip.start_seconds <= range.endSeconds
    );
  });
}
