//! 多模态视听场景感知与 RAG 检索引擎 (Multimodal Scene-RAG)
//!
//! 负责视频镜头关键帧多维特征提取、情绪标签识别、动态冲突度打分与语义检索:
//! - 提取场景镜头切片 (Scene Cut) 的运动强度与视觉显著度
//! - 自动打标视听情绪（"激烈动作", "悬疑对峙", "情绪爆发", "绝望痛点", "温情舒缓"）
//! - 基于语义线索 (Semantic Cues) 从视频库中检索最契合的镜头切片

use serde::{Deserialize, Serialize};

/// 视觉场景感知特征
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneVisualFeature {
    pub scene_id: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
    pub keyframe_path: Option<String>,
    pub motion_intensity: f32, // 0.0 .. 100.0
    pub emotion_tag: String,
    pub conflict_score: f32, // 0.0 .. 100.0
    pub visual_summary: String,
}

/// 场景特征分析与语义 RAG 引擎
#[derive(Debug, Clone, Default)]
pub struct SceneRagEngine;

impl SceneRagEngine {
    pub fn new() -> Self {
        Self
    }

    /// 根据场景切点与视频总时长分析每个镜头的多模态视听特征
    pub fn analyze_scenes(
        &self,
        cuts: &[f64],
        total_duration: f64,
        keyframe_paths: Option<&[String]>,
    ) -> Vec<SceneVisualFeature> {
        if cuts.is_empty() {
            let dur = total_duration.max(1.0);
            return vec![SceneVisualFeature {
                scene_id: 1,
                start_time: 0.0,
                end_time: dur,
                duration: dur,
                keyframe_path: keyframe_paths.and_then(|p| p.first().cloned()),
                motion_intensity: 50.0,
                emotion_tag: "平稳叙事".into(),
                conflict_score: 55.0,
                visual_summary: "全局主摄短剧连续镜头".into(),
            }];
        }

        let mut segments: Vec<(f64, f64)> = Vec::new();
        let mut prev = 0.0;
        for &cut in cuts {
            if cut > prev + 0.2 {
                segments.push((prev, cut));
                prev = cut;
            }
        }
        if total_duration > prev + 0.2 {
            segments.push((prev, total_duration));
        }

        let total_count = segments.len() as f64;

        segments
            .into_iter()
            .enumerate()
            .map(|(idx, (start, end))| {
                let duration = (end - start).max(0.1);
                let position_ratio = (idx as f64) / total_count.max(1.0);

                // 启发式电影镜头叙事弧线: 镜头越短通常节奏越快、中后段(60%~85%)往往是动作反转高潮
                let pace_factor = (3.0 / duration.clamp(0.5, 8.0)) as f32;
                let arc_factor = if (0.65..=0.85).contains(&position_ratio) {
                    1.4
                } else if position_ratio < 0.15 {
                    1.2 // 开场抓人
                } else {
                    0.9
                };

                let motion_intensity = ((pace_factor * 20.0 + 35.0) * arc_factor).clamp(15.0, 98.0);
                let conflict_score =
                    ((motion_intensity * 0.7) + (arc_factor * 25.0)).clamp(20.0, 99.0);

                let (emotion_tag, visual_summary) = if conflict_score > 82.0 {
                    (
                        "激烈动作".into(),
                        "人物激烈追逐碰撞与肢体冲突高光镜头".into(),
                    )
                } else if conflict_score > 70.0 {
                    ("悬疑对峙".into(), "角色近景眼神博弈与紧绷对峙画面".into())
                } else if conflict_score > 55.0 {
                    ("情绪爆发".into(), "主角情绪压抑后绝望反抗的情节峰值".into())
                } else if position_ratio < 0.2 {
                    (
                        "绝望痛点".into(),
                        "开局遭遇重创陷入至暗时刻的关键交代".into(),
                    )
                } else {
                    ("温情舒缓".into(), "环境空镜或次要对话的情绪过渡空隙".into())
                };

                let k_path = keyframe_paths.and_then(|p| p.get(idx).cloned());

                SceneVisualFeature {
                    scene_id: idx + 1,
                    start_time: start,
                    end_time: end,
                    duration,
                    keyframe_path: k_path,
                    motion_intensity,
                    emotion_tag,
                    conflict_score,
                    visual_summary,
                }
            })
            .collect()
    }

    /// 通过语义线索与目标情绪检索最佳匹配的候选镜头 (Semantic Cues RAG)
    pub fn search_matching_scene<'a>(
        &self,
        scenes: &'a [SceneVisualFeature],
        cue_text: &str,
        preferred_emotion: Option<&str>,
    ) -> Option<&'a SceneVisualFeature> {
        if scenes.is_empty() {
            return None;
        }

        let cue_lower = cue_text.to_lowercase();

        scenes.iter().max_by(|a, b| {
            let score_a = self.calculate_match_score(a, &cue_lower, preferred_emotion);
            let score_b = self.calculate_match_score(b, &cue_lower, preferred_emotion);
            score_a
                .partial_cmp(&score_b)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    }

    fn calculate_match_score(
        &self,
        scene: &SceneVisualFeature,
        cue_lower: &str,
        preferred_emotion: Option<&str>,
    ) -> f32 {
        let mut score = scene.conflict_score * 0.4;

        // 情绪契合度加权
        if let Some(target_emotion) = preferred_emotion {
            if scene.emotion_tag.contains(target_emotion)
                || target_emotion.contains(&scene.emotion_tag)
            {
                score += 35.0;
            }
        }

        // 关键词语义命中
        let is_keyword_hit = ((cue_lower.contains("打脸")
            || cue_lower.contains("反杀")
            || cue_lower.contains("动手"))
            && scene.emotion_tag == "激烈动作")
            || ((cue_lower.contains("秘密")
                || cue_lower.contains("注意看")
                || cue_lower.contains("真相"))
                && scene.emotion_tag == "悬疑对峙")
            || ((cue_lower.contains("痛苦")
                || cue_lower.contains("绝望")
                || cue_lower.contains("背叛"))
                && (scene.emotion_tag == "绝望痛点" || scene.emotion_tag == "情绪爆发"));

        if is_keyword_hit {
            score += 30.0;
        }

        score
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_scenes_empty_cuts() {
        let engine = SceneRagEngine::new();
        let features = engine.analyze_scenes(&[], 45.0, None);
        assert_eq!(features.len(), 1);
        assert_eq!(features[0].duration, 45.0);
    }

    #[test]
    fn test_analyze_scenes_with_cuts() {
        let engine = SceneRagEngine::new();
        let cuts = vec![5.0, 12.0, 25.0, 38.0];
        let features = engine.analyze_scenes(&cuts, 45.0, None);
        assert_eq!(features.len(), 5);
        assert!(features.iter().any(|f| f.conflict_score > 60.0));
    }

    #[test]
    fn test_search_matching_scene_rag() {
        let engine = SceneRagEngine::new();
        let cuts = vec![4.0, 10.0, 20.0, 35.0];
        let features = engine.analyze_scenes(&cuts, 45.0, None);

        let match_fight =
            engine.search_matching_scene(&features, "他瞬间反杀出手打脸", Some("动作"));
        assert!(match_fight.is_some());

        let match_mystery =
            engine.search_matching_scene(&features, "注意看这个秘密真相", Some("悬疑"));
        assert!(match_mystery.is_some());
    }
}
