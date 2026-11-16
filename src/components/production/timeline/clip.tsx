/**
 * dramaxis v1.2.0 · 时间轴音画切片渲染器 (AudioWaveformVisual & Clip Items)
 */

export interface TimelineClipItem {
  id: string;
  title: string;
  start: number;
  duration: number;
  emotion?: string;
  matchScore?: number;
  speedAdjustment?: number;
  isBroll?: boolean;
}

export function AudioWaveformVisual({
  seed,
  colorClass = "bg-emerald-400/60",
  barsCount = 28,
}: {
  seed: string;
  colorClass?: string;
  barsCount?: number;
}) {
  const bars = Array.from({ length: barsCount }).map((_, idx) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i) + idx * 17;
      hash |= 0;
    }
    const val = Math.abs(hash % 100);
    return Math.max(16, Math.min(96, (val % 72) + (idx % 3 === 0 ? 8 : 22)));
  });

  return (
    <div className="flex items-center gap-[1.5px] h-full w-full overflow-hidden opacity-55 pointer-events-none select-none">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-xs transition-all ${colorClass}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
