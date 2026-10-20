//! 8 维全频音画指纹消重矩阵引擎 (Deduplication Matrix Engine)
//!
//! 针对各主流短视频平台 (抖音/TikTok/快手/小红书/B站/YouTube Shorts) 的内容特征指纹算法:
//! 1. 画面动态微缩放 (Dynamic Zoom: 1.01x ~ 1.08x)
//! 2. 帧率微变速 (Micro Speed: 1.005x ~ 1.05x，音画严格同步重采样)
//! 3. 智能画面镜像 (Smart Mirror: 水平翻转)
//! 4. 高频胶片噪点 (Film Grain Noise: 1% ~ 5% 动态 ISO 颗粒)
//! 5. 抽插帧与帧率漂移 (FPS Drift: 瓦解全局关键帧哈希)
//! 6. 音频微调音高 (Pitch Shift: 共振峰与音高微移，保持绝对时长)
//! 7. BGM 空间混响 (Reverb & Low/High Cut Filtering)
//! 8. 元数据随机擦除与伪装 (Metadata Scrub: 擦除源 EXIF，注入伪随机编码签名)

use serde::{Deserialize, Serialize};

/// 消重强度预设
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DedupIntensity {
    Mild,
    Standard,
    Aggressive,
    Custom,
}

/// 8 维消重矩阵参数
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupOptions {
    /// 强度模式
    #[serde(default = "default_intensity")]
    pub intensity: DedupIntensity,
    /// 1. 画面动态微缩放 (1.01 ~ 1.08)
    pub enable_zoom: bool,
    pub zoom_rate: f64,
    /// 2. 帧率微变速 (1.005 ~ 1.05)
    pub enable_speed: bool,
    pub speed_rate: f64,
    /// 3. 智能画面镜像 (hflip)
    pub enable_mirror: bool,
    /// 4. 高频胶片噪点 (0.01 ~ 0.05)
    pub enable_noise: bool,
    pub noise_strength: f64,
    /// 5. 抽插帧与帧率漂移 (例如 29.97 -> 30.08)
    pub enable_fps_drift: bool,
    pub fps_drift_val: f64,
    /// 6. 音频微调音高 (1.01 ~ 1.03)
    pub enable_pitch_shift: bool,
    pub pitch_shift_rate: f64,
    /// 7. BGM 空间混响
    pub enable_bgm_reverb: bool,
    pub reverb_decay: f64,
    /// 8. 元数据随机擦除与伪装签名
    pub enable_metadata_scrub: bool,
}

fn default_intensity() -> DedupIntensity {
    DedupIntensity::Standard
}

impl Default for DedupOptions {
    fn default() -> Self {
        Self::standard()
    }
}

impl DedupOptions {
    /// 轻度混淆 (画质音质损耗最小)
    pub fn mild() -> Self {
        Self {
            intensity: DedupIntensity::Mild,
            enable_zoom: true,
            zoom_rate: 1.02,
            enable_speed: true,
            speed_rate: 1.01,
            enable_mirror: false,
            enable_noise: true,
            noise_strength: 0.01,
            enable_fps_drift: false,
            fps_drift_val: 30.0,
            enable_pitch_shift: false,
            pitch_shift_rate: 1.0,
            enable_bgm_reverb: false,
            reverb_decay: 0.2,
            enable_metadata_scrub: true,
        }
    }

    /// 工业标准预设 (推荐)
    pub fn standard() -> Self {
        Self {
            intensity: DedupIntensity::Standard,
            enable_zoom: true,
            zoom_rate: 1.04,
            enable_speed: true,
            speed_rate: 1.02,
            enable_mirror: false,
            enable_noise: true,
            noise_strength: 0.02,
            enable_fps_drift: true,
            fps_drift_val: 30.05,
            enable_pitch_shift: true,
            pitch_shift_rate: 1.015,
            enable_bgm_reverb: true,
            reverb_decay: 0.3,
            enable_metadata_scrub: true,
        }
    }

    /// 强力裂变预设 (全频高强度混淆)
    pub fn aggressive() -> Self {
        Self {
            intensity: DedupIntensity::Aggressive,
            enable_zoom: true,
            zoom_rate: 1.06,
            enable_speed: true,
            speed_rate: 1.035,
            enable_mirror: true,
            enable_noise: true,
            noise_strength: 0.035,
            enable_fps_drift: true,
            fps_drift_val: 30.12,
            enable_pitch_shift: true,
            pitch_shift_rate: 1.025,
            enable_bgm_reverb: true,
            reverb_decay: 0.45,
            enable_metadata_scrub: true,
        }
    }

    /// 构建视频流滤镜链 (基于基准分辨率宽与高)
    pub fn build_video_filters(&self, base_w: u32, base_h: u32) -> Vec<String> {
        let mut filters = Vec::new();

        // 1. 微缩放与居中裁切
        if self.enable_zoom && (self.zoom_rate - 1.0).abs() > 0.001 {
            let zw = (((base_w as f64) * self.zoom_rate) as u32 / 2) * 2;
            let zh = (((base_h as f64) * self.zoom_rate) as u32 / 2) * 2;
            filters.push(format!("scale={zw}:{zh},crop={base_w}:{base_h}"));
        }

        // 2. 画面水平翻转
        if self.enable_mirror {
            filters.push("hflip".into());
        }

        // 3. 动态高斯胶片颗粒噪点 (alls: 强度 1..10, allf=t+u 时域与平滑抖动)
        if self.enable_noise && self.noise_strength > 0.001 {
            let noise_int = ((self.noise_strength * 100.0).round() as u32).clamp(1, 10);
            filters.push(format!("noise=alls={noise_int}:allf=t+u"));
        }

        // 4. 帧率漂移 / 抽插帧
        if self.enable_fps_drift && self.fps_drift_val > 1.0 {
            filters.push(format!("fps=fps={:.3}", self.fps_drift_val));
        }

        // 5. 帧率微变速 setpts (若有微变速)
        if self.enable_speed && (self.speed_rate - 1.0).abs() > 0.001 {
            let pts_factor = 1.0 / self.speed_rate;
            filters.push(format!("setpts={pts_factor:.4}*PTS"));
        }

        filters
    }

    /// 构建音频流滤镜链 (配音/混音轨)
    pub fn build_audio_filters(&self) -> Vec<String> {
        let mut filters = Vec::new();

        // 1. 微调音高 (asetrate 改变重采样基准频率 + atempo 补偿回原播放速度，改变共振峰与音高)
        if self.enable_pitch_shift && (self.pitch_shift_rate - 1.0).abs() > 0.001 {
            let target_rate = (44100.0 * self.pitch_shift_rate).round() as u32;
            let tempo_compensate = 1.0 / self.pitch_shift_rate;
            filters.push(format!(
                "asetrate={target_rate},atempo={tempo_compensate:.4}"
            ));
        }

        // 2. 音频微变速 (与视频 speed_rate 严格对齐)
        if self.enable_speed && (self.speed_rate - 1.0).abs() > 0.001 {
            filters.push(format!("atempo={:.4}", self.speed_rate));
        }

        // 3. 空间微混响
        if self.enable_bgm_reverb {
            let decay = self.reverb_decay.clamp(0.1, 0.6);
            filters.push(format!("aecho=0.8:0.88:35:{decay:.2}"));
        }

        filters
    }

    /// 构建元数据随机重写参数
    pub fn build_metadata_args(&self, project_name: &str, seed: u64) -> Vec<String> {
        if !self.enable_metadata_scrub {
            return Vec::new();
        }

        let pseudo_hash = format!("{:012x}", seed.wrapping_mul(0x5DEECE66D));
        vec![
            "-map_metadata".into(),
            "-1".into(),
            "-metadata".into(),
            format!("title={project_name}"),
            "-metadata".into(),
            format!("comment=Master_{pseudo_hash}"),
            "-metadata".into(),
            "encoder=Lavf59.27.100".into(),
        ]
    }
}

/// 批量裂变方案生成器 (生成 N 个具备独特参数的防重方案)
pub fn generate_fission_variants(base: &DedupOptions, count: usize) -> Vec<DedupOptions> {
    if count == 0 {
        return Vec::new();
    }
    let mut variants = Vec::with_capacity(count);

    for i in 0..count {
        let mut v = base.clone();
        v.intensity = DedupIntensity::Custom;

        // 根据变体索引微调各参数，确保每个变体指纹各不相同
        let delta = ((i as f64) * 0.007) % 0.03;
        if v.enable_zoom {
            v.zoom_rate = (1.02 + delta * 1.5).clamp(1.01, 1.08);
        }
        if v.enable_speed {
            v.speed_rate = (1.01 + delta).clamp(1.005, 1.05);
        }
        if v.enable_noise {
            v.noise_strength = (0.015 + delta * 0.5).clamp(0.01, 0.05);
        }
        if v.enable_fps_drift {
            v.fps_drift_val = 30.0 + ((i as f64) * 0.03);
        }
        if v.enable_pitch_shift {
            let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
            v.pitch_shift_rate = 1.0 + (sign * (0.008 + delta * 0.4)).clamp(-0.03, 0.03);
        }
        if i % 3 == 2 {
            // 每隔 3 个变体尝试智能镜像
            v.enable_mirror = true;
        }

        variants.push(v);
    }

    variants
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dedup_presets() {
        let mild = DedupOptions::mild();
        assert_eq!(mild.intensity, DedupIntensity::Mild);
        assert!(mild.zoom_rate < 1.03);

        let std = DedupOptions::standard();
        assert_eq!(std.intensity, DedupIntensity::Standard);
        assert!(std.enable_pitch_shift);

        let agg = DedupOptions::aggressive();
        assert_eq!(agg.intensity, DedupIntensity::Aggressive);
        assert!(agg.enable_mirror);
    }

    #[test]
    fn test_build_video_filters() {
        let std = DedupOptions::standard();
        let filters = std.build_video_filters(1080, 1920);
        assert!(!filters.is_empty());
        assert!(filters.iter().any(|f| f.starts_with("scale=")));
        assert!(filters.iter().any(|f| f.starts_with("noise=")));
        assert!(filters.iter().any(|f| f.starts_with("setpts=")));
    }

    #[test]
    fn test_build_audio_filters() {
        let std = DedupOptions::standard();
        let a_filters = std.build_audio_filters();
        assert!(!a_filters.is_empty());
        assert!(a_filters.iter().any(|f| f.starts_with("asetrate=")));
        assert!(a_filters.iter().any(|f| f.starts_with("atempo=")));
        assert!(a_filters.iter().any(|f| f.starts_with("aecho=")));
    }

    #[test]
    fn test_generate_fission_variants() {
        let std = DedupOptions::standard();
        let variants = generate_fission_variants(&std, 5);
        assert_eq!(variants.len(), 5);

        // 验证变体间参数各不相同
        let r0 = variants[0].zoom_rate;
        let r1 = variants[1].zoom_rate;
        assert_ne!(r0, r1);
    }

    #[test]
    fn test_metadata_args() {
        let opt = DedupOptions::standard();
        let args = opt.build_metadata_args("TestMovie", 123456);
        assert!(args.contains(&"-map_metadata".to_string()));
        assert!(args.contains(&"-1".to_string()));
        assert!(args.contains(&"title=TestMovie".to_string()));
    }
}
