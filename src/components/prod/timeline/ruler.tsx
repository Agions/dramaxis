/**
 * dramaxis v1.3.0 · 时间轴标尺刻度组件 (TimelineRuler)
 */

interface TimelineRulerProps {
  durationSeconds: number;
  formatTime: (seconds: number) => string;
}

export function TimelineRuler({
  durationSeconds,
  formatTime,
}: TimelineRulerProps) {
  const dur = durationSeconds > 0 ? durationSeconds : 60;
  return (
    <div className="h-4 w-full flex justify-between pl-[124px] pr-2 font-mono text-[9px] text-text-muted border-b border-border/60">
      <span>00:00.0</span>
      <span>{formatTime(dur * 0.25)}</span>
      <span>{formatTime(dur * 0.5)}</span>
      <span>{formatTime(dur * 0.75)}</span>
      <span>{formatTime(dur)}</span>
    </div>
  );
}
