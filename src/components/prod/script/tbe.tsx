/**
 * dramaxis P1-2 · 以文剪片 (Text-Based Editing) 双向联动编辑器
 *
 * 支持：
 * - 解说旁白 (narration)、原片原声金句 (original_clip) 与气口停顿 (pause) 混排编辑
 * - 实时语速字数/时长预算测算（4.3 字/秒）
 * - 波纹删除（联动时间轴移除对应片段）、上下重排、点击定位播控游标
 */

export type TbeSegmentKind = "narration" | "original_clip" | "pause";

export interface TbeSegment {
  id: string;
  kind: TbeSegmentKind;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  sourceInSec?: number;
  sourceOutSec?: number;
}

export interface TextBasedEditorProps {
  segments: TbeSegment[];
  onChange: (next: TbeSegment[]) => void;
  onRippleDelete?: (segmentId: string) => void;
  onSeek?: (seconds: number) => void;
}

const KIND_META: Record<
  TbeSegmentKind,
  { label: string; badgeClass: string }
> = {
  narration: {
    label: "解说旁白",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  original_clip: {
    label: "原声金句",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  pause: {
    label: "气口停顿",
    badgeClass: "bg-zinc-600/30 text-zinc-300 border-zinc-500/40",
  },
};

function estimateDurationSec(seg: TbeSegment): number {
  if (
    seg.kind === "original_clip" &&
    seg.sourceInSec !== undefined &&
    seg.sourceOutSec !== undefined &&
    seg.sourceOutSec > seg.sourceInSec
  ) {
    return +(seg.sourceOutSec - seg.sourceInSec).toFixed(1);
  }
  if (
    seg.startSeconds !== undefined &&
    seg.endSeconds !== undefined &&
    seg.endSeconds > seg.startSeconds
  ) {
    return +(seg.endSeconds - seg.startSeconds).toFixed(1);
  }
  if (seg.kind === "pause") return 0.5;
  return +Math.max(1.0, seg.text.trim().length / 4.3).toFixed(1);
}

export function TextBasedEditor({
  segments,
  onChange,
  onRippleDelete,
  onSeek,
}: TextBasedEditorProps) {
  const handleTextChange = (id: string, text: string) => {
    onChange(segments.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= segments.length) return;
    const next = [...segments];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next);
  };

  const handleDelete = (id: string) => {
    onChange(segments.filter((s) => s.id !== id));
    onRippleDelete?.(id);
  };

  const handleInsertKind = (kind: TbeSegmentKind) => {
    const newSeg: TbeSegment =
      kind === "original_clip"
        ? {
            id: `tbe-orig-${Date.now()}`,
            kind: "original_clip",
            text: "（保留原片高光原声对白）",
            sourceInSec: 0,
            sourceOutSec: 3.0,
          }
        : kind === "pause"
          ? {
              id: `tbe-pause-${Date.now()}`,
              kind: "pause",
              text: "[0.5s 悬念停顿]",
              startSeconds: 0,
              endSeconds: 0.5,
            }
          : {
              id: `tbe-narr-${Date.now()}`,
              kind: "narration",
              text: "",
            };
    onChange([...segments, newSeg]);
  };

  const totalSec = segments
    .reduce((acc, s) => acc + estimateDurationSec(s), 0)
    .toFixed(1);

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="text-text-muted">
          共 <span className="font-semibold text-text">{segments.length}</span>{" "}
          段 · 预计总时长{" "}
          <span className="font-semibold text-accent">{totalSec}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleInsertKind("original_clip")}
            className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
          >
            + 原声金句
          </button>
          <button
            type="button"
            onClick={() => handleInsertKind("pause")}
            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
          >
            + 气口停顿
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {segments.map((seg, idx) => {
          const meta = KIND_META[seg.kind];
          const dur = estimateDurationSec(seg);
          return (
            <div
              key={seg.id}
              data-testid={`tbe-card-${seg.id}`}
              className="rounded-lg border border-border/70 bg-surface/70 p-2.5 transition-colors hover:border-accent/50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSeek?.(seg.startSeconds ?? seg.sourceInSec ?? 0)}
                    className="font-mono text-[10px] text-text-muted hover:text-accent"
                  >
                    ~{dur}s
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="上移段落"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-hover disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="下移段落"
                    disabled={idx === segments.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-hover disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="波纹删除段落"
                    onClick={() => handleDelete(seg.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-500/15"
                  >
                    删除
                  </button>
                </div>
              </div>

              {seg.kind === "pause" ? (
                <div className="text-[11px] italic text-text-muted">
                  叙事停顿 {dur}s（自动保留环境呼吸感）
                </div>
              ) : (
                <textarea
                  value={seg.text}
                  onChange={(e) => handleTextChange(seg.id, e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded border border-border/50 bg-bg/70 px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
