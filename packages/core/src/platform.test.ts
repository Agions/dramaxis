import { describe, it, expect } from 'vitest';
import {
  PLATFORM_PRESETS,
  getPlatformPreset,
  listPlatformPresets,
  type PlatformId,
} from './platform';

describe('Dramaxis Platform Matrix Presets', () => {
  it('covers all 8 major short/long video platforms', () => {
    const list = listPlatformPresets();
    expect(list).toHaveLength(8);
    const ids = list.map(p => p.id);
    expect(ids).toContain('douyin');
    expect(ids).toContain('kuaishou');
    expect(ids).toContain('xiaohongshu');
    expect(ids).toContain('wechat');
    expect(ids).toContain('tiktok');
    expect(ids).toContain('bilibili');
    expect(ids).toContain('youtube');
    expect(ids).toContain('youtube-shorts');
  });

  it('getPlatformPreset returns specific preset or defaults to douyin', () => {
    const p = getPlatformPreset('bilibili');
    expect(p.aspectRatio).toBe('16:9');
    expect(p.resolution).toBe('1920x1080');

    const fallback = getPlatformPreset('unknown' as PlatformId);
    expect(fallback.id).toBe('douyin');
  });

  it('antiDeduplication configs are defined for all presets', () => {
    for (const preset of Object.values(PLATFORM_PRESETS)) {
      expect(preset.antiDeduplication).toBeDefined();
      expect(preset.antiDeduplication.cropZoomRatio).toBeGreaterThanOrEqual(1.0);
      expect(preset.antiDeduplication.recommendedSpeedRange[0]).toBeGreaterThanOrEqual(1.0);
    }
  });
});
