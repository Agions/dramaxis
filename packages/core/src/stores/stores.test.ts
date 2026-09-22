import { describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings-store";
import { getEffectiveTheme, useThemeStore } from "./theme-store";

describe("settings-store", () => {
  it("initializes with defaults", () => {
    const s = useSettingsStore.getState();
    expect(s.locale).toBe("zh-CN");
    expect(s.autoSaveIntervalSec).toBe(60);
    expect(s.initialized).toBe(false);
  });

  it("syncs from backend snapshot", () => {
    useSettingsStore.getState().syncFromSnapshot({
      language: "en-US",
      llm_provider: "deepseek",
    });
    const s = useSettingsStore.getState();
    expect(s.locale).toBe("en-US");
    expect(s.llmDefaultProvider).toBe("deepseek");
    expect(s.initialized).toBe(true);
  });
});

describe("theme-store", () => {
  it("resolves effective theme", () => {
    expect(getEffectiveTheme("light")).toBe("light");
    expect(getEffectiveTheme("dark")).toBe("dark");
  });

  it("toggles theme correctly", () => {
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe("light");
  });
});
