//! 语义 + 情绪双驱动声画对齐引擎 (Semantic & Emotion Dual-Driven Alignment)
//!
//! 将编剧生成的剧本段落与 Scene-RAG 视觉特征库进行最优匹配:
//! - 语义线索与情绪共鸣打分
//! - 自适应镜头微变速 (Adaptive Speed Trimming: 0.90x ~ 1.15x)
//! - 镜头不足时自动推荐 B-roll 特写并生成对齐报告

use dramaxis_core::domain::{ScriptSegment, SegmentKind};
use dramaxis_detect::SceneVisualFeature;
use serde::{Deserialize, Serialize};

/// 混排声画对齐块（支持解说旁白、原片原声金句与叙事停顿）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InterleavedTimelineBlock {
    pub segment_id: String,
    pub kind: SegmentKind,
    pub timeline_start: f64,
    pub timeline_end: f64,
    pub source_in: f64,
    pub source_out: f64,
    pub text: String,
    /// 是否压低 BGM（解说旁白与原声金句期间自动触发侧链闪避）
    pub duck_bgm: bool,
    /// 是否保留原片人声音轨（仅 `OriginalClip` 为 true）
    pub keep_original_audio: bool,
}

/// 单句文案与视觉镜头的对齐匹配结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentMatch {
    pub script_index: usize,
    pub script_text: String,
    pub script_emotion: String,
    pub matched_scene_id: usize,
    pub scene_start: f64,
    pub scene_end: f64,
    pub scene_emotion: String,
    pub match_score: f32,      // 0.0 .. 100.0
    pub speed_adjustment: f64, // 0.90 .. 1.15
    pub is_broll_inserted: bool,
}

/// 完整声画对齐规划
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentPlan {
    pub overall_sync_score: f32, // 整体声画契合指数 (0..100)
    pub matches: Vec<AlignmentMatch>,
    pub total_duration: f64,
}

/// 声画对齐调度器
#[derive(Debug, Clone, Default)]
pub struct DualDrivenAligner;

impl DualDrivenAligner {
    pub fn new() -> Self {
        Self
    }

    /// 对齐剧本台词与场景视觉特征库
    pub fn align(
        &self,
        scenes: &[SceneVisualFeature],
        script_lines: &[String],
        voice_duration: f64,
    ) -> AlignmentPlan {
        if script_lines.is_empty() {
            return AlignmentPlan {
                overall_sync_score: 100.0,
                matches: Vec::new(),
                total_duration: voice_duration,
            };
        }

        if scenes.is_empty() {
            // 兜底: 无切片时默认全屏连续匹配
            let total_dur = voice_duration.max(10.0);
            let slice_dur = total_dur / (script_lines.len() as f64).max(1.0);
            let matches = script_lines
                .iter()
                .enumerate()
                .map(|(i, line)| AlignmentMatch {
                    script_index: i + 1,
                    script_text: line.clone(),
                    script_emotion: "通用叙述".into(),
                    matched_scene_id: 1,
                    scene_start: (i as f64) * slice_dur,
                    scene_end: ((i + 1) as f64) * slice_dur,
                    scene_emotion: "平稳叙事".into(),
                    match_score: 75.0,
                    speed_adjustment: 1.0,
                    is_broll_inserted: false,
                })
                .collect();

            return AlignmentPlan {
                overall_sync_score: 75.0,
                matches,
                total_duration: total_dur,
            };
        }

        let mut matches = Vec::with_capacity(script_lines.len());
        let mut total_score = 0.0;
        let mut used_scene_counts = std::collections::HashMap::<usize, usize>::new();
        let mut last_scene_end = 0.0;

        for (idx, line) in script_lines.iter().enumerate() {
            let script_emotion = self.infer_script_emotion(line);

            // 搜索最佳视觉镜头 (优先匹配高潮、冲突与语义关键词，结合时序向前推进与镜头复用惩罚)
            let (best_scene, score) = self.find_best_scene(
                scenes,
                line,
                &script_emotion,
                idx,
                last_scene_end,
                &used_scene_counts,
            );

            *used_scene_counts.entry(best_scene.scene_id).or_insert(0) += 1;
            last_scene_end = best_scene.end_time;

            // 计算镜头自适应微变速 (若该句估计朗读时长与镜头原始时长有差异)
            let est_voice_len = ((line.chars().count() as f64) / 4.0).clamp(1.5, 8.0);
            let scene_dur = best_scene.duration;
            let ratio = scene_dur / est_voice_len;
            let speed_adjustment = if (0.85..=1.15).contains(&ratio) {
                ratio
            } else {
                1.0
            };

            matches.push(AlignmentMatch {
                script_index: idx + 1,
                script_text: line.clone(),
                script_emotion,
                matched_scene_id: best_scene.scene_id,
                scene_start: best_scene.start_time,
                scene_end: best_scene.end_time,
                scene_emotion: best_scene.emotion_tag.clone(),
                match_score: score,
                speed_adjustment: (speed_adjustment * 100.0).round() / 100.0,
                is_broll_inserted: ratio < 0.6,
            });

            total_score += score;
        }

        let avg_score = total_score / (script_lines.len() as f32).max(1.0);

        AlignmentPlan {
            overall_sync_score: (avg_score * 10.0).round() / 10.0,
            matches,
            total_duration: voice_duration.max(10.0),
        }
    }

    /// P1-2: 混排声画对齐（支持 `Narration` 解说、`OriginalClip` 原片金句穿插与 `Pause` 气口停顿）
    pub fn align_mixed_segments(
        &self,
        scenes: &[SceneVisualFeature],
        segments: &[ScriptSegment],
    ) -> Vec<InterleavedTimelineBlock> {
        let mut blocks = Vec::with_capacity(segments.len());
        let mut cursor = 0.0_f64;

        for seg in segments {
            match seg.kind {
                SegmentKind::OriginalClip => {
                    let src_in = seg
                        .source_in_sec
                        .or(seg.start_seconds)
                        .unwrap_or(0.0)
                        .max(0.0);
                    let src_out = seg
                        .source_out_sec
                        .or(seg.end_seconds)
                        .unwrap_or(src_in + 3.0)
                        .max(src_in + 0.5);
                    let dur = src_out - src_in;
                    blocks.push(InterleavedTimelineBlock {
                        segment_id: seg.id.clone(),
                        kind: SegmentKind::OriginalClip,
                        timeline_start: cursor,
                        timeline_end: cursor + dur,
                        source_in: src_in,
                        source_out: src_out,
                        text: seg.text.clone(),
                        duck_bgm: true,
                        keep_original_audio: true,
                    });
                    cursor += dur;
                }
                SegmentKind::Pause => {
                    let dur = match (seg.start_seconds, seg.end_seconds) {
                        (Some(s), Some(e)) if e > s => (e - s).clamp(0.2, 3.0),
                        _ => 0.5,
                    };
                    blocks.push(InterleavedTimelineBlock {
                        segment_id: seg.id.clone(),
                        kind: SegmentKind::Pause,
                        timeline_start: cursor,
                        timeline_end: cursor + dur,
                        source_in: cursor,
                        source_out: cursor + dur,
                        text: String::new(),
                        duck_bgm: false,
                        keep_original_audio: false,
                    });
                    cursor += dur;
                }
                SegmentKind::Narration => {
                    let est_dur = match (seg.start_seconds, seg.end_seconds) {
                        (Some(s), Some(e)) if e > s => e - s,
                        _ => ((seg.text.chars().count() as f64) / 4.3).max(1.2),
                    };
                    let matched = scenes.iter().max_by(|a, b| {
                        a.conflict_score
                            .partial_cmp(&b.conflict_score)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                    let src_in = matched.map(|m| m.start_time).unwrap_or(0.0);
                    let src_out = matched
                        .map(|m| (m.start_time + est_dur).min(m.end_time.max(m.start_time + 0.5)))
                        .unwrap_or(src_in + est_dur);
                    blocks.push(InterleavedTimelineBlock {
                        segment_id: seg.id.clone(),
                        kind: SegmentKind::Narration,
                        timeline_start: cursor,
                        timeline_end: cursor + est_dur,
                        source_in: src_in,
                        source_out: src_out,
                        text: seg.text.clone(),
                        duck_bgm: true,
                        keep_original_audio: false,
                    });
                    cursor += est_dur;
                }
            }
        }

        blocks
    }

    fn infer_script_emotion(&self, text: &str) -> String {
        if text.contains("打脸")
            || text.contains("反杀")
            || text.contains("动手")
            || text.contains("死")
        {
            "激烈动作".into()
        } else if text.contains("注意看")
            || text.contains("谁能想到")
            || text.contains("秘密")
            || text.contains("真相")
        {
            "悬疑对峙".into()
        } else if text.contains("绝望")
            || text.contains("背叛")
            || text.contains("大火")
            || text.contains("跪")
        {
            "情绪爆发".into()
        } else {
            "平稳叙事".into()
        }
    }

    fn find_best_scene<'a>(
        &self,
        scenes: &'a [SceneVisualFeature],
        line: &str,
        emotion: &str,
        line_idx: usize,
        last_scene_end: f64,
        used_counts: &std::collections::HashMap<usize, usize>,
    ) -> (&'a SceneVisualFeature, f32) {
        // 如果是第一句 (黄金3秒)，优先找冲突最强的高光镜头
        if line_idx == 0 {
            if let Some(climax) = scenes.iter().max_by(|a, b| {
                a.conflict_score
                    .partial_cmp(&b.conflict_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            }) {
                return (climax, 96.0);
            }
        }

        let mut best = &scenes[0];
        let mut best_score: f32 = f32::NEG_INFINITY;

        for s in scenes {
            let reuse_count = used_counts.get(&s.scene_id).copied().unwrap_or(0);
            let reuse_penalty = (reuse_count as f32) * 15.0;
            let mut s_score = (s.conflict_score * 0.4 - reuse_penalty).max(0.0);

            if s.emotion_tag == emotion {
                s_score += 40.0;
            }
            if (line.contains("谁能想到") || line.contains("真相")) && s.emotion_tag == "悬疑对峙"
            {
                s_score += 20.0;
            }
            // 时序平滑前进偏置: 镜头起点在上一镜头之后或接近上一镜头，保证视听持续向前流动
            if s.start_time >= last_scene_end {
                s_score += 6.0;
            }

            if s_score > best_score {
                best_score = s_score;
                best = s;
            }
        }

        let final_score = best_score.clamp(60.0, 98.0);
        (best, final_score)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dual_driven_alignment_empty() {
        let aligner = DualDrivenAligner::new();
        let plan = aligner.align(&[], &[], 30.0);
        assert_eq!(plan.overall_sync_score, 100.0);
        assert!(plan.matches.is_empty());
    }

    #[test]
    fn test_dual_driven_alignment_matching() {
        let aligner = DualDrivenAligner::new();
        let scenes = vec![
            SceneVisualFeature {
                scene_id: 1,
                start_time: 0.0,
                end_time: 4.0,
                duration: 4.0,
                keyframe_path: None,
                motion_intensity: 90.0,
                emotion_tag: "激烈动作".into(),
                conflict_score: 95.0,
                visual_summary: "高能打脸反杀镜头".into(),
                is_vlm_verified: false,
                has_hard_subtitle: false,
            },
            SceneVisualFeature {
                scene_id: 2,
                start_time: 4.0,
                end_time: 15.0,
                duration: 11.0,
                keyframe_path: None,
                motion_intensity: 40.0,
                emotion_tag: "悬疑对峙".into(),
                conflict_score: 65.0,
                visual_summary: "角色紧绷眼神对视".into(),
                is_vlm_verified: false,
                has_hard_subtitle: false,
            },
        ];

        let lines = vec![
            "注意看，这个男人在众目睽睽之下强势复仇打脸！".into(),
            "谁能想到这一切只是神秘势力的阴谋圈套。".into(),
        ];

        let plan = aligner.align(&scenes, &lines, 15.0);
        assert_eq!(plan.matches.len(), 2);
        assert!(plan.overall_sync_score > 80.0);
        assert_eq!(plan.matches[0].matched_scene_id, 1);
    }

    #[test]
    fn test_dual_driven_alignment_temporal_progression() {
        let aligner = DualDrivenAligner::new();
        let scenes = vec![
            SceneVisualFeature {
                scene_id: 1,
                start_time: 0.0,
                end_time: 3.0,
                duration: 3.0,
                keyframe_path: None,
                motion_intensity: 95.0,
                emotion_tag: "激烈动作".into(),
                conflict_score: 98.0,
                visual_summary: "开篇冲突".into(),
                is_vlm_verified: false,
                has_hard_subtitle: false,
            },
            SceneVisualFeature {
                scene_id: 2,
                start_time: 3.0,
                end_time: 8.0,
                duration: 5.0,
                keyframe_path: None,
                motion_intensity: 60.0,
                emotion_tag: "平稳叙事".into(),
                conflict_score: 50.0,
                visual_summary: "中景叙事".into(),
                is_vlm_verified: false,
                has_hard_subtitle: false,
            },
            SceneVisualFeature {
                scene_id: 3,
                start_time: 8.0,
                end_time: 14.0,
                duration: 6.0,
                keyframe_path: None,
                motion_intensity: 70.0,
                emotion_tag: "悬疑对峙".into(),
                conflict_score: 75.0,
                visual_summary: "真相揭晓".into(),
                is_vlm_verified: false,
                has_hard_subtitle: false,
            },
        ];

        let lines = vec![
            "开场高能反杀动手！".into(),
            "随后他回到了阔别已久的故乡老街。".into(),
            "谁能想到这一切只是幕后黑手的试探。".into(),
        ];

        let plan = aligner.align(&scenes, &lines, 14.0);
        assert_eq!(plan.matches.len(), 3);
        // 第一句命中最高冲突镜头 1
        assert_eq!(plan.matches[0].matched_scene_id, 1);
        // 后续句子自然平滑向前推进，命中场景 2 与 3
        assert_eq!(plan.matches[1].matched_scene_id, 2);
        assert_eq!(plan.matches[2].matched_scene_id, 3);
    }

    #[test]
    fn test_interleaved_original_dialogue_and_pause_alignment() {
        let aligner = DualDrivenAligner::new();
        let segments = vec![
            ScriptSegment {
                id: "s1".into(),
                text: "就在所有人嘲笑他是个废物时，下一秒全场鸦雀无声。".into(),
                kind: SegmentKind::Narration,
                ..Default::default()
            },
            ScriptSegment {
                id: "s2".into(),
                text: "跪下！从今天起这里我说了算！".into(),
                kind: SegmentKind::OriginalClip,
                source_in_sec: Some(42.0),
                source_out_sec: Some(45.5),
                ..Default::default()
            },
            ScriptSegment {
                id: "s3".into(),
                kind: SegmentKind::Pause,
                start_seconds: Some(0.0),
                end_seconds: Some(0.4),
                ..Default::default()
            },
        ];

        let blocks = aligner.align_mixed_segments(&[], &segments);
        assert_eq!(blocks.len(), 3);
        assert!(!blocks[0].keep_original_audio);
        assert!(blocks[0].duck_bgm);
        assert!(blocks[1].keep_original_audio);
        assert!((blocks[1].source_in - 42.0).abs() < 1e-3);
        assert!((blocks[1].timeline_end - blocks[1].timeline_start - 3.5).abs() < 1e-3);
        assert!(!blocks[2].duck_bgm);
        assert!((blocks[2].timeline_end - blocks[2].timeline_start - 0.4).abs() < 1e-3);
    }
}
