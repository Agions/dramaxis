/**
 * dramaxis v1.2.0 · 时间轴标尺刻度组件 (TimelineRuler)
 */

interface TimelineRulerProps {
  durationSeconds: number;
  formatTime: (seconds: number) => string;
}

export function TimelineRuler({
  durationSeconds,
  formatTime,
}: TimelineRulerProps) {
  return (
    <div className="h-4 w-full flex justify-between pl-30 pr-2 font-mono text-[9px] text-text-muted border-b border-border/60">
      <span>00:00.0</span>
      <span>00:15.0</span>
      <span>00:30.0</span>
      <span>00:45.0</span>
      <span>{formatTime(durationSeconds)}</span>
    </div>
  );
}
