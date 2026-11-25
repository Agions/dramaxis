//! 多平台影视母带与视听后处理引擎 (Multi-Platform Audio/Video Mastering Engine)
//!
//! 提供面向主流短视频平台与多渠道自适应分发的工业级母带后处理管线:
//! 1. 画面动态微缩放与安全区适配 (Dynamic Zoom: 1.01x ~ 1.08x)
//! 2. 帧率微变速与时间重采样 (Micro Speed: 1.005x ~ 1.05x，音画严格同步重采样)
//! 3. 画面构图水平微调 (Smart Mirror: 水平翻转以适配异型构图)
//! 4. 电影级胶片颗粒质感 (Film Grain Noise: 1% ~ 5% 动态 ISO 颗粒增强胶片质感)
//! 5. 帧率自适应与时间轴重映射 (FPS Drift & Retiming)
//! 6. 音频共振峰与微调音高 (Pitch Shift: 针对不同声画情绪进行音高微移)
//! 7. 空间环绕与混响处理 (Reverb & Low/High Cut Filtering)
//! 8. 母带标准工业元数据封装 (Mastering Metadata: 注入 Dramaxis 规范元数据)

use serde::{Deserialize, Serialize};

/// 母带处理强度预设 (兼容消重强度定义)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MasterIntensity {
    Mild,
    Standard,
    Aggressive,
    Custom,
}

pub type DedupIntensity = MasterIntensity;

/// 原片硬字幕区域处理模式（避免与新解说字幕双层重叠打架）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum SubtitleMaskMode {
    /// 不处理原片字幕区域
    #[default]
    None,
    /// 底部硬字幕区域智能柔化抹除 (delogo)
    BlurBox,
    /// 裁切底部 14% 硬字幕区并等比放大还原安全画幅
    CropBottom,
    /// 底部半透明深色垫底条（适合新字幕直接覆盖其上）
    GradientBar,
}

/// 发布前防搬运与合规自检风险等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DedupRiskLevel {
    Low,
    Medium,
    High,
}

/// 发布前母带原创度与平台合规体检报告 (P1-4)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreFlightDedupReport {
    pub originality_score: f32,
    pub risk_level: DedupRiskLevel,
    pub hard_subtitle_safe: bool,
    pub compliance_tagged: bool,
    pub recommendations: Vec<String>,
}

/// 多平台视听母带后处理参数 (兼容原 DedupOptions 字段与契约)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterOptions {
    /// 强度模式
    #[serde(default = "default_intensity")]
    pub intensity: MasterIntensity,
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
    /// 5. 帧率漂移与抽插帧
    pub enable_fps_drift: bool,
    pub fps_drift_val: f64,
    /// 6. 音频微调音高 (1.01 ~ 1.03)
    pub enable_pitch_shift: bool,
    pub pitch_shift_rate: f64,
    /// 7. BGM 空间混响
    pub enable_bgm_reverb: bool,
    pub reverb_decay: f64,
    /// 8. 元数据规范化封装
    pub enable_metadata_scrub: bool,
    /// 9. (P1-4) 原片硬字幕智能遮罩/裁切模式
    #[serde(default)]
    pub subtitle_mask_mode: SubtitleMaskMode,
    /// 10. (P1-4) 动态 Ken Burns 非均匀微变焦曲线
    #[serde(default)]
    pub enable_dynamic_ken_burns: bool,
    /// 11. (P1-4) AI 合成内容法规合规元数据标识
    #[serde(default)]
    pub ai_compliance_badge: bool,
}

pub type DedupOptions = MasterOptions;

fn default_intensity() -> MasterIntensity {
    MasterIntensity::Standard
}

impl Default for MasterOptions {
    fn default() -> Self {
        Self::standard()
    }
}

impl MasterOptions {
    /// 轻度处理预设 (画质音质损耗最小)
    pub fn mild() -> Self {
        Self {
            intensity: MasterIntensity::Mild,
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
            subtitle_mask_mode: SubtitleMaskMode::None,
            enable_dynamic_ken_burns: false,
            ai_compliance_badge: true,
        }
    }

    /// 工业标准预设 (推荐)
    pub fn standard() -> Self {
        Self {
            intensity: MasterIntensity::Standard,
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
            subtitle_mask_mode: SubtitleMaskMode::GradientBar,
            enable_dynamic_ken_burns: false,
            ai_compliance_badge: true,
        }
    }

    /// 增强模式 (全频母带微调)
    pub fn aggressive() -> Self {
        Self {
            intensity: MasterIntensity::Aggressive,
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
            subtitle_mask_mode: SubtitleMaskMode::BlurBox,
            enable_dynamic_ken_burns: true,
            ai_compliance_badge: true,
        }
    }

    /// 构建视频流滤镜链 (基于基准分辨率宽与高)
    pub fn build_video_filters(&self, base_w: u32, base_h: u32) -> Vec<String> {
        let mut filters = Vec::new();

        // 1. 动态 Ken Burns 曲线或静态微缩放裁切
        if self.enable_dynamic_ken_burns {
            filters.push(format!(
                "scale=w='iw*(1.02+0.02*sin(t*0.7))':h='ih*(1.02+0.02*sin(t*0.7))':eval=frame,crop={base_w}:{base_h}"
            ));
        } else if self.enable_zoom && (self.zoom_rate - 1.0).abs() > 0.001 {
            let zw = (((base_w as f64) * self.zoom_rate) as u32 / 2) * 2;
            let zh = (((base_h as f64) * self.zoom_rate) as u32 / 2) * 2;
            filters.push(format!("scale={zw}:{zh},crop={base_w}:{base_h}"));
        }

        // 1b. 原片硬字幕智能遮罩/裁切（防止双层字幕重叠）
        match self.subtitle_mask_mode {
            SubtitleMaskMode::None => {}
            SubtitleMaskMode::BlurBox => {
                let mask_x = (base_w / 20).max(2);
                let mask_w = base_w.saturating_sub(mask_x * 2).max(4);
                let mask_y = ((base_h as f64) * 0.80) as u32;
                let mask_h = ((base_h as f64) * 0.12).max(4.0) as u32;
                filters.push(format!(
                    "delogo=x={mask_x}:y={mask_y}:w={mask_w}:h={mask_h}"
                ));
            }
            SubtitleMaskMode::CropBottom => {
                let crop_h = (((base_h as f64) * 0.86) as u32 / 2) * 2;
                filters.push(format!(
                    "crop={base_w}:{crop_h}:0:0,scale={base_w}:{base_h}"
                ));
            }
            SubtitleMaskMode::GradientBar => {
                let bar_y = ((base_h as f64) * 0.80) as u32;
                let bar_h = ((base_h as f64) * 0.14) as u32;
                filters.push(format!(
                    "drawbox=x=0:y={bar_y}:w={base_w}:h={bar_h}:color=black@0.72:t=fill"
                ));
            }
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

        // 1. 微调音高 (asetrate 改变重采样基准频率 + atempo 补偿回原播放速度 + aresample 恢复 48kHz 广播级标称采样率)
        if self.enable_pitch_shift && (self.pitch_shift_rate - 1.0).abs() > 0.001 {
            let target_rate = (48000.0 * self.pitch_shift_rate).round() as u32;
            let tempo_compensate = 1.0 / self.pitch_shift_rate;
            filters.push(format!(
                "asetrate={target_rate},atempo={tempo_compensate:.4},aresample=48000"
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

    /// 构建元数据工业母带封装参数
    pub fn build_metadata_args(&self, project_name: &str, seed: u64) -> Vec<String> {
        if !self.enable_metadata_scrub {
            return Vec::new();
        }

        let pseudo_hash = format!("{:012x}", seed.wrapping_mul(0x5DEECE66D));
        let mut args = vec![
            "-map_metadata".into(),
            "-1".into(),
            "-metadata".into(),
            format!("title={project_name}"),
            "-metadata".into(),
            format!("comment=Master_{pseudo_hash}"),
            "-metadata".into(),
            "encoder=Dramaxis Mastering Studio v1.4".into(),
        ];
        if self.ai_compliance_badge {
            args.push("-metadata".into());
            args.push("ai_generated=true".into());
            args.push("-metadata".into());
            args.push("compliance_label=Dramaxis_AI_Synthesized".into());
        }
        args
    }

    /// P1-4: 发布前原创度与平台合规自检评估
    pub fn evaluate_preflight(
        &self,
        has_original_clips: bool,
        hard_sub_detected: bool,
    ) -> PreFlightDedupReport {
        let mut score: f32 = 45.0;
        let mut recs = Vec::new();

        if self.enable_zoom || self.enable_dynamic_ken_burns {
            score += if self.enable_dynamic_ken_burns {
                14.0
            } else {
                10.0
            };
        } else {
            recs.push("建议开启微缩放或动态 Ken Burns 变焦以降低画面像素指纹重合度".into());
        }
        if self.enable_speed {
            score += 8.0;
        }
        if self.enable_noise {
            score += 7.0;
        }
        if self.enable_fps_drift {
            score += 6.0;
        }
        if self.enable_pitch_shift {
            score += 6.0;
        }
        if self.enable_metadata_scrub {
            score += 6.0;
        }
        if has_original_clips {
            score += 8.0;
        } else {
            recs.push("适当穿插 15%~25% 原片高光原声金句可显著提升完播率与二次创作特征".into());
        }

        let hard_subtitle_safe =
            !hard_sub_detected || self.subtitle_mask_mode != SubtitleMaskMode::None;
        if !hard_subtitle_safe {
            score -= 15.0;
            recs.push(
                "检测到原片含底部硬字幕，建议开启 GradientBar 垫底或 BlurBox 遮罩避免双字幕重叠"
                    .into(),
            );
        }
        if !self.ai_compliance_badge {
            recs.push("建议保留 AI 合成内容合规元数据标识以满足主流平台审核要求".into());
        }

        let final_score = score.clamp(0.0, 100.0);
        let risk_level = if final_score >= 80.0 && hard_subtitle_safe {
            DedupRiskLevel::Low
        } else if final_score >= 60.0 {
            DedupRiskLevel::Medium
        } else {
            DedupRiskLevel::High
        };

        PreFlightDedupReport {
            originality_score: final_score,
            risk_level,
            hard_subtitle_safe,
            compliance_tagged: self.ai_compliance_badge,
            recommendations: recs,
        }
    }
}

/// 多平台母带差异化变体生成器 (生成 N 个具备针对性微调参数的母带导出配置)
pub fn generate_master_variants(base: &MasterOptions, count: usize) -> Vec<MasterOptions> {
    if count == 0 {
        return Vec::new();
    }
    let mut variants = Vec::with_capacity(count);

    for i in 0..count {
        let mut v = base.clone();
        v.intensity = MasterIntensity::Custom;

        // 根据变体索引微调各参数，确保每个母带规格各具针对性
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
            v.enable_mirror = true;
        }

        variants.push(v);
    }

    variants
}

/// 兼容历史别名
pub fn generate_fission_variants(base: &MasterOptions, count: usize) -> Vec<MasterOptions> {
    generate_master_variants(base, count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dedup_presets() {
        let mild = MasterOptions::mild();
        assert_eq!(mild.intensity, MasterIntensity::Mild);
        assert!(mild.zoom_rate < 1.03);

        let std = MasterOptions::standard();
        assert_eq!(std.intensity, MasterIntensity::Standard);
        assert!(std.enable_pitch_shift);

        let agg = MasterOptions::aggressive();
        assert_eq!(agg.intensity, MasterIntensity::Aggressive);
        assert!(agg.enable_mirror);
    }

    #[test]
    fn test_build_video_filters() {
        let std = MasterOptions::standard();
        let filters = std.build_video_filters(1080, 1920);
        assert!(!filters.is_empty());
        assert!(filters.iter().any(|f| f.starts_with("scale=")));
        assert!(filters.iter().any(|f| f.starts_with("noise=")));
        assert!(filters.iter().any(|f| f.starts_with("setpts=")));
    }

    #[test]
    fn test_build_audio_filters() {
        let std = MasterOptions::standard();
        let a_filters = std.build_audio_filters();
        assert!(!a_filters.is_empty());
        assert!(a_filters.iter().any(|f| f.starts_with("asetrate=")));
        assert!(a_filters.iter().any(|f| f.starts_with("atempo=")));
        assert!(a_filters.iter().any(|f| f.starts_with("aecho=")));
    }

    #[test]
    fn test_generate_fission_variants() {
        let std = MasterOptions::standard();
        let variants = generate_master_variants(&std, 5);
        assert_eq!(variants.len(), 5);

        let r0 = variants[0].zoom_rate;
        let r1 = variants[1].zoom_rate;
        assert_ne!(r0, r1);
    }

    #[test]
    fn test_metadata_args() {
        let opt = MasterOptions::standard();
        let args = opt.build_metadata_args("TestMovie", 123456);
        assert!(args.contains(&"-map_metadata".to_string()));
        assert!(args.contains(&"-1".to_string()));
        assert!(args.contains(&"title=TestMovie".to_string()));
        assert!(args.contains(&"ai_generated=true".to_string()));
    }

    #[test]
    fn test_subtitle_mask_ken_burns_and_preflight_report() {
        let mut opts = MasterOptions::aggressive();
        let filters = opts.build_video_filters(1080, 1920);
        assert!(filters.iter().any(|f| f.contains("sin(t*0.7)")));
        assert!(filters.iter().any(|f| f.starts_with("delogo=")));

        let report_low = opts.evaluate_preflight(true, true);
        assert_eq!(report_low.risk_level, DedupRiskLevel::Low);
        assert!(report_low.hard_subtitle_safe);
        assert!(report_low.originality_score >= 85.0);

        opts.subtitle_mask_mode = SubtitleMaskMode::None;
        let report_warn = opts.evaluate_preflight(false, true);
        assert!(!report_warn.hard_subtitle_safe);
        assert!(!report_warn.recommendations.is_empty());
    }
}
