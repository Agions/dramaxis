/**
 * dramaxis v1.1.0 · 影视视听播放与毫秒级时钟调度 Store (PlaybackStore)
 *
 * 核心特性:
 * - 播放时钟高频状态 (60fps) 彻底与工作台重型 DOM 解耦
 * - 仅 Playhead 指针、刻度指示器与视频监视器订阅此 Store
 * - 支持 seek、play、pause、toggle、setDuration、reset
 */

import { create } from "zustand";

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  currentTime: 0,
  duration: 60,
  isPlaying: false,

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setDuration: (duration) => set({ duration: Math.max(1, duration) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  reset: () => set({ currentTime: 0, duration: 60, isPlaying: false }),
}));
