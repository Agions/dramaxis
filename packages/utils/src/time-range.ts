/**
 * 时间码解析 (SSOT)
 *
 * 场景切片的 `time` 字段形如 "00:12 - 00:27"。此前该解析在
 * ExportStudioPanel / useTimelineDerivedClips 中被复制 5 次, 统一收敛于此。
 */

/** 解析 "mm:ss" 为秒; 非法输入按 0 处理 (与历史行为一致) */
export function parseClock(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

/** 解析 "mm:ss - mm:ss" 为 [start, end]; 缺少结束段时 end 为 undefined */
export function parseTimeRange(time: string): {
  start: number;
  end: number | undefined;
} {
  const parts = time.split(" - ").map(parseClock);
  return { start: parts[0] ?? 0, end: parts[1] };
}

/** 切点 = 区间结束秒; 缺失时回退到起点 */
export function parseCutPoint(time: string): number {
  const { start, end } = parseTimeRange(time);
  return end ?? start;
}
