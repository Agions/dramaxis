import { describe, it, expect } from "vitest";
import { parseClock, parseCutPoint, parseTimeRange } from "./time-range";

describe("time-range", () => {
  it("parseClock 解析 mm:ss 且对非法输入回退为 0", () => {
    expect(parseClock("01:30")).toBe(90);
    expect(parseClock("abc")).toBe(0);
    expect(parseClock("")).toBe(0);
  });

  it("parseTimeRange 解析区间, 缺少结束段时 end 为 undefined", () => {
    expect(parseTimeRange("00:12 - 00:27")).toEqual({ start: 12, end: 27 });
    expect(parseTimeRange("00:12")).toEqual({ start: 12, end: undefined });
  });

  it("parseCutPoint 取区间结束秒并回退到起点", () => {
    expect(parseCutPoint("00:12 - 00:27")).toBe(27);
    expect(parseCutPoint("00:12")).toBe(12);
  });
});
