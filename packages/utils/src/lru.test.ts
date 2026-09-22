import { describe, expect, it } from "vitest";
import { LRUCache } from "./lru";

describe("LRUCache", () => {
  it("应支持基本的存取并遵循最大容量淘汰规则", () => {
    const cache = new LRUCache<string, number>(3);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBe(1);

    // 存入第 4 个元素，应淘汰最久未访问的 "b" (因为 "a" 刚刚被 get 访问过)
    cache.set("d", 4);

    expect(cache.size).toBe(3);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("应支持 clear 和 delete", () => {
    const cache = new LRUCache<string, string>(5);
    cache.set("k1", "v1");
    cache.set("k2", "v2");

    expect(cache.delete("k1")).toBe(true);
    expect(cache.has("k1")).toBe(false);

    cache.clear();
    expect(cache.size).toBe(0);
  });
});
