/**
 * dramaxis v1.3.0 · 轨道控制头组件 (TrackHeader)
 */

export type TrackId = "V1" | "HK" | "A1" | "SUB" | "BGM";

export interface TrackControlState {
  muted: boolean;
  solo: boolean;
  locked: boolean;
}

interface TrackHeaderProps {
  trackId: TrackId;
  label: string;
  colorClass: string;
  control: TrackControlState;
  onToggleControl: (trackId: TrackId, control: keyof TrackControlState) => void;
}

export function TrackHeader({
  trackId,
  label,
  colorClass,
  control,
  onToggleControl,
}: TrackHeaderProps) {
  return (
    <div className="flex items-center justify-between w-28 pr-1.5 shrink-0 select-none">
      <span className={`font-mono text-[10px] font-bold ${colorClass} truncate`}>
        {label}
      </span>
      <div className="flex items-center gap-0.5">
        {/* Mute 开关 */}
        <button
          type="button"
          title={control.muted ? "取消静音/显示该轨" : "静音/隐藏该轨 (M)"}
          aria-label={`${trackId}-mute`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleControl(trackId, "muted");
          }}
          className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
            control.muted
              ? "bg-rose-500/25 border-rose-500 text-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.4)]"
              : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
          }`}
        >
          M
        </button>

        {/* Solo 开关 */}
        <button
          type="button"
          title={control.solo ? "取消独显 (S)" : "独奏/独显该轨 (S)"}
          aria-label={`${trackId}-solo`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleControl(trackId, "solo");
          }}
          className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
            control.solo
              ? "bg-amber-500/25 border-amber-500 text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
              : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
          }`}
        >
          S
        </button>

        {/* Lock 开关 */}
        <button
          type="button"
          title={control.locked ? "解锁该轨 (L)" : "锁定轨道防误触 (L)"}
          aria-label={`${trackId}-lock`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleControl(trackId, "locked");
          }}
          className={`h-4 w-4 rounded text-[9px] font-bold flex items-center justify-center border transition-all ${
            control.locked
              ? "bg-sky-500/25 border-sky-500 text-sky-400 shadow-[0_0_6px_rgba(14,165,233,0.4)]"
              : "bg-surface-elevated/80 border-border text-text-muted hover:text-text-primary hover:border-text-secondary"
          }`}
        >
          L
        </button>
      </div>
    </div>
  );
}
