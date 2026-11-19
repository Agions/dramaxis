/**
 * dramaxis v1.3.0 · 播放头与选区遮罩组件 (PlayheadCursor & MarkRangeMask)
 */

interface PlayheadCursorProps {
  playheadPercent: number;
}

export function PlayheadCursor({ playheadPercent }: PlayheadCursorProps) {
  return (
    <div
      className="absolute top-0 bottom-0 z-30 w-[2px] bg-gradient-to-b from-gold via-amber-400 to-amber-600 shadow-[0_0_8px_var(--color-gold)] pointer-events-none transition-all duration-75"
      style={{
        left: `calc(112px + (100% - 112px) * ${playheadPercent / 100})`,
      }}
    >
      <div className="h-2 w-2 -translate-x-[3px] rotate-45 bg-gold shadow-[0_0_6px_var(--color-gold)]" />
    </div>
  );
}

interface MarkRangeMaskProps {
  markIn: number;
  markOut: number;
  durationSeconds: number;
  formatTime: (sec: number) => string;
}

export function MarkRangeMask({
  markIn,
  markOut,
  durationSeconds,
  formatTime,
}: MarkRangeMaskProps) {
  if (markOut <= markIn) return null;

  return (
    <div
      className="absolute top-0 bottom-0 bg-gold/15 border-x-2 border-gold/80 pointer-events-none z-20 shadow-[0_0_12px_rgba(245,200,66,0.2)]"
      style={{
        left: `calc(112px + (100% - 112px) * ${markIn / (durationSeconds || 1)})`,
        width: `calc((100% - 112px) * ${(markOut - markIn) / (durationSeconds || 1)})`,
      }}
    >
      <div className="absolute top-0 left-0 text-[8px] bg-gold text-zinc-950 font-bold px-1 rounded-br font-mono">
        IN {formatTime(markIn)}
      </div>
      <div className="absolute top-0 right-0 text-[8px] bg-gold text-zinc-950 font-bold px-1 rounded-bl font-mono">
        OUT {formatTime(markOut)}
      </div>
    </div>
  );
}
