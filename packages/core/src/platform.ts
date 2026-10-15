/**
 * Dramaxis (剧枢) · 8 大短视频/影视平台矩阵预设与消重规则配置
 * 融合自 Fablr (剧工) 核心消重矩阵
 */

export type PlatformId =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'wechat'
  | 'tiktok'
  | 'bilibili'
  | 'youtube'
  | 'youtube-shorts';

export interface PlatformPreset {
  id: PlatformId;
  name: string;
  nameEn: string;
  category: 'short-form' | 'long-form' | 'social';
  aspectRatio: '9:16' | '16:9' | '3:4';
  resolution: string;
  maxDurationSecs: number | null;
  recommendedBitrate: string;
  fps: number;
  antiDeduplication: {
    recommendedSpeedRange: [number, number];
    cropZoomRatio: number;
    enableColorCorrection: boolean;
    enableAudioDuck: boolean;
  };
}

export const PLATFORM_PRESETS: Record<PlatformId, PlatformPreset> = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    nameEn: 'Douyin',
    category: 'short-form',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSecs: 600,
    recommendedBitrate: '8000k',
    fps: 30,
    antiDeduplication: {
      recommendedSpeedRange: [1.02, 1.08],
      cropZoomRatio: 1.03,
      enableColorCorrection: true,
      enableAudioDuck: true,
    },
  },
  kuaishou: {
    id: 'kuaishou',
    name: '快手',
    nameEn: 'Kuaishou',
    category: 'short-form',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSecs: 600,
    recommendedBitrate: '6000k',
    fps: 30,
    antiDeduplication: {
      recommendedSpeedRange: [1.01, 1.06],
      cropZoomRatio: 1.02,
      enableColorCorrection: true,
      enableAudioDuck: true,
    },
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    nameEn: 'RED',
    category: 'social',
    aspectRatio: '3:4',
    resolution: '1080x1440',
    maxDurationSecs: 900,
    recommendedBitrate: '8000k',
    fps: 30,
    antiDeduplication: {
      recommendedSpeedRange: [1.0, 1.05],
      cropZoomRatio: 1.02,
      enableColorCorrection: true,
      enableAudioDuck: false,
    },
  },
  wechat: {
    id: 'wechat',
    name: '微信视频号',
    nameEn: 'WeChat Channels',
    category: 'social',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSecs: 1800,
    recommendedBitrate: '8000k',
    fps: 30,
    antiDeduplication: {
      recommendedSpeedRange: [1.01, 1.05],
      cropZoomRatio: 1.02,
      enableColorCorrection: true,
      enableAudioDuck: true,
    },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    nameEn: 'TikTok',
    category: 'short-form',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSecs: 600,
    recommendedBitrate: '10000k',
    fps: 60,
    antiDeduplication: {
      recommendedSpeedRange: [1.03, 1.1],
      cropZoomRatio: 1.04,
      enableColorCorrection: true,
      enableAudioDuck: true,
    },
  },
  bilibili: {
    id: 'bilibili',
    name: '哔哩哔哩',
    nameEn: 'Bilibili',
    category: 'long-form',
    aspectRatio: '16:9',
    resolution: '1920x1080',
    maxDurationSecs: null,
    recommendedBitrate: '12000k',
    fps: 60,
    antiDeduplication: {
      recommendedSpeedRange: [1.0, 1.05],
      cropZoomRatio: 1.01,
      enableColorCorrection: false,
      enableAudioDuck: true,
    },
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    nameEn: 'YouTube',
    category: 'long-form',
    aspectRatio: '16:9',
    resolution: '1920x1080',
    maxDurationSecs: null,
    recommendedBitrate: '12000k',
    fps: 60,
    antiDeduplication: {
      recommendedSpeedRange: [1.0, 1.03],
      cropZoomRatio: 1.01,
      enableColorCorrection: false,
      enableAudioDuck: true,
    },
  },
  'youtube-shorts': {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    nameEn: 'YouTube Shorts',
    category: 'short-form',
    aspectRatio: '9:16',
    resolution: '1080x1920',
    maxDurationSecs: 60,
    recommendedBitrate: '10000k',
    fps: 60,
    antiDeduplication: {
      recommendedSpeedRange: [1.02, 1.08],
      cropZoomRatio: 1.03,
      enableColorCorrection: true,
      enableAudioDuck: true,
    },
  },
};

export function getPlatformPreset(id: PlatformId): PlatformPreset {
  return PLATFORM_PRESETS[id] ?? PLATFORM_PRESETS.douyin;
}

export function listPlatformPresets(): PlatformPreset[] {
  return Object.values(PLATFORM_PRESETS);
}
