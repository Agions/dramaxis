import { describe, expect, it } from "vitest";
import { calculateVisibleTimeRange, filterVisibleClips } from "./virtual-timeline";

describe("virtual-timeline", () => {
  it("应准确计算当前视口的时间跨度", () => {
    const range = calculateVisibleTimeRange({
      containerWidth: 1000,
      scrollLeft: 200,
      zoomLevel: 100, // 100px = 1s
      bufferSeconds: 1.0,
    });

    // scrollLeft=200px ➔ 2s - 1s buffer = 1s
    expect(range.startSeconds).toBe(1.0);
    // (200 + 1000) / 100 ➔ 12s + 1s buffer = 13s
    expect(range.endSeconds).toBe(13.0);
  });

  it("应正确筛选与视口存在交集的片段", () => {
    const clips = [
      { id: "c1", start_seconds: 0, in_seconds: 0, out_seconds: 3 }, // 0~3s
      { id: "c2", start_seconds: 5, in_seconds: 0, out_seconds: 4 }, // 5~9s
      { id: "c3", start_seconds: 15, in_seconds: 0, out_seconds: 5 }, // 15~20s
    ];

    const range = { startSeconds: 4.0, endSeconds: 10.0 };
    const visible = filterVisibleClips(clips, range);

    expect(visible.map((c) => c.id)).toEqual(["c2"]);
  });
});
