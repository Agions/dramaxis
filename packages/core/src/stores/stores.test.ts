import { describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings-store";
import { getEffectiveTheme, useThemeStore } from "./theme-store";
import { usePlaybackStore } from "./playback-store";
import { useWorkshopStore } from "./workshop-store";

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

describe("playback-store", () => {
  it("manages playback state and seek operations", () => {
    const store = usePlaybackStore.getState();

    store.setDuration(120);
    expect(usePlaybackStore.getState().duration).toBe(120);

    store.seek(45.5);
    expect(usePlaybackStore.getState().currentTime).toBe(45.5);

    store.setIsPlaying(true);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);

    store.togglePlay();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);

    store.reset();
    expect(usePlaybackStore.getState().currentTime).toBe(0);
  });
});

describe("workshop-store", () => {
  it("tracks workshop dirty states and transitions", () => {
    const store = useWorkshopStore.getState();

    expect(store.activeWorkshop).toBe("assets");
    store.setActiveWorkshop("script");
    expect(useWorkshopStore.getState().activeWorkshop).toBe("script");

    store.markDirty("scriptDirty", true);
    expect(useWorkshopStore.getState().dirtyState.scriptDirty).toBe(true);

    store.resetAllDirty();
    expect(useWorkshopStore.getState().dirtyState.scriptDirty).toBe(false);
  });
});
