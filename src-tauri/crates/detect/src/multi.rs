//! 多模态视听场景感知与 RAG 检索引擎 (Multimodal Scene-RAG)
//!
//! 负责视频镜头关键帧多维特征提取、情绪标签识别、动态冲突度打分与语义检索:
//! - 提取场景镜头切片 (Scene Cut) 的运动强度与视觉显著度
//! - 自动打标视听情绪（"激烈动作", "悬疑对峙", "情绪爆发", "绝望痛点", "温情舒缓"）
//! - 基于语义线索 (Semantic Cues) 从视频库中检索最契合的镜头切片

use dramaxis_core::{CancelToken, MediaScheduler, ResourceSlot};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

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
    /// 是否经过真实多模态 VLM 视觉模型校验（false 表示启发式兜底）
    #[serde(default)]
    pub is_vlm_verified: bool,
    /// 是否检测到原片底部存在硬字幕（供后续母带消重/遮罩决策）
    #[serde(default)]
    pub has_hard_subtitle: bool,
}

/// VLM 批量拼图视觉标注结构
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VlmSceneAnnotation {
    pub scene_id: usize,
    pub emotion_tag: String,
    pub conflict_score: f32,
    pub visual_summary: String,
    #[serde(default)]
    pub has_hard_subtitle: bool,
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
                is_vlm_verified: false,
                has_hard_subtitle: false,
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
                    is_vlm_verified: false,
                    has_hard_subtitle: false,
                }
            })
            .collect()
    }

    /// 将多张关键帧拼接为网格图（Contact Sheet），单次 VLM 调用可覆盖 9~16 个镜头，节省 80%+ 视觉 Token
    pub async fn build_contact_sheet(
        &self,
        keyframe_paths: &[String],
        output_path: &Path,
        cols: u32,
        rows: u32,
        cancel: &CancelToken,
    ) -> Result<PathBuf, String> {
        let valid_paths: Vec<&String> = keyframe_paths
            .iter()
            .filter(|p| Path::new(p).exists())
            .take((cols * rows) as usize)
            .collect();
        if valid_paths.is_empty() {
            return Err("没有可用于拼图的有效关键帧文件".into());
        }

        let _permit = MediaScheduler::global()
            .acquire_cancellable(ResourceSlot::Ffmpeg, cancel)
            .await
            .ok_or_else(|| "拼图任务已取消".to_string())?;

        // 生成 FFmpeg concat 列表 + tile 滤镜，避免命令行输入数过多
        let list_path = output_path.with_extension("concat.txt");
        let list_body = valid_paths
            .iter()
            .map(|p| format!("file '{}'\n", p.replace('\'', "'\\''")))
            .collect::<String>();
        std::fs::write(&list_path, list_body).map_err(|e| format!("写入拼图清单失败: {e}"))?;

        let tile_filter = format!("scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile={cols}x{rows}");
        let mut cmd = Command::new("ffmpeg");
        cmd.args([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list_path.to_string_lossy(),
            "-vf",
            &tile_filter,
            "-frames:v",
            "1",
            "-q:v",
            "3",
            &output_path.to_string_lossy(),
        ]);

        let run_res = cancel.run_command(&mut cmd).await;
        let _ = std::fs::remove_file(&list_path);

        let output = run_res
            .map_err(|e| format!("FFmpeg 启动失败: {e}"))?
            .ok_or_else(|| "拼图任务被用户取消".to_string())?;

        if !output.status.success() || !output_path.exists() {
            return Err(format!(
                "Contact-Sheet 拼图生成失败: {}",
                String::from_utf8_lossy(&output.stderr)
                    .lines()
                    .last()
                    .unwrap_or("unknown")
            ));
        }

        Ok(output_path.to_path_buf())
    }

    /// 构造供多模态 VLM 分析网格拼图的结构化 Prompt
    pub fn build_contact_sheet_vlm_prompt(&self, shot_count: usize, start_scene_id: usize) -> String {
        format!(
            "这是一张按从左到右、从上到下顺序拼接的影视关键帧网格图，共包含 {shot_count} 个镜头（编号从 {start_scene_id} 到 {}）。\
            请逐格观察真实画面内容，严格输出 JSON 数组（不要附加多余解释），每个元素格式如下：\
            [{{\"sceneId\":{start_scene_id},\"emotionTag\":\"激烈动作|悬疑对峙|情绪爆发|绝望痛点|温情舒缓\",\"conflictScore\":0-100,\"visualSummary\":\"20字以内的真实画面人物与动作描述\",\"hasHardSubtitle\":true/false}}]",
            start_scene_id + shot_count.saturating_sub(1)
        )
    }

    /// 解析 VLM 返回的 JSON 数组（兼容 Markdown ```json 代码块包裹）
    pub fn parse_vlm_scene_response(&self, raw: &str) -> Vec<VlmSceneAnnotation> {
        let trimmed = raw.trim();
        let json_slice = if let (Some(start), Some(end)) = (trimmed.find('['), trimmed.rfind(']')) {
            if end >= start {
                &trimmed[start..=end]
            } else {
                trimmed
            }
        } else {
            trimmed
        };

        serde_json::from_str::<Vec<VlmSceneAnnotation>>(json_slice).unwrap_or_else(|e| {
            tracing::warn!("VLM 场景标注 JSON 解析失败，保持兜底特征: {e}");
            Vec::new()
        })
    }

    /// 将真实 VLM 视觉标注融合进 SceneVisualFeature 列表，返回成功更新的镜头数量
    pub fn merge_vlm_annotations(
        &self,
        features: &mut [SceneVisualFeature],
        annotations: &[VlmSceneAnnotation],
    ) -> usize {
        let mut updated = 0usize;
        for ann in annotations {
            if let Some(feat) = features.iter_mut().find(|f| f.scene_id == ann.scene_id) {
                if !ann.visual_summary.trim().is_empty() {
                    feat.visual_summary = ann.visual_summary.trim().to_string();
                }
                if !ann.emotion_tag.trim().is_empty() {
                    feat.emotion_tag = ann.emotion_tag.trim().to_string();
                }
                feat.conflict_score = ann.conflict_score.clamp(0.0, 100.0);
                feat.has_hard_subtitle = ann.has_hard_subtitle;
                feat.is_vlm_verified = true;
                updated += 1;
            }
        }
        updated
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

        // 真实视觉摘要语义重合度加分（双字切词重叠，适配中文影视画面描述）
        let summary_lower = scene.visual_summary.to_lowercase();
        let cue_chars: Vec<char> = cue_lower
            .chars()
            .filter(|c| !c.is_whitespace() && !c.is_ascii_punctuation())
            .collect();
        let mut bigram_hits = 0usize;
        for win in cue_chars.windows(2) {
            let bigram: String = win.iter().collect();
            if summary_lower.contains(&bigram) {
                bigram_hits += 1;
            }
        }
        score += (bigram_hits as f32 * 12.0).min(48.0);

        if scene.is_vlm_verified {
            score += 8.0;
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
        assert!(!features[0].is_vlm_verified);
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
    fn test_vlm_response_parse_merge_and_semantic_rag() {
        let engine = SceneRagEngine::new();
        let cuts = vec![5.0, 12.0, 20.0];
        let mut features = engine.analyze_scenes(&cuts, 30.0, None);

        let raw_vlm = r#"```json
[
  {"sceneId": 1, "emotionTag": "温情舒缓", "conflictScore": 30.0, "visualSummary": "女主在咖啡厅安静看书", "hasHardSubtitle": false},
  {"sceneId": 2, "emotionTag": "激烈动作", "conflictScore": 95.0, "visualSummary": "暴雨夜黑衣保镖在天台持刀追杀男主", "hasHardSubtitle": true}
]
```"#;
        let anns = engine.parse_vlm_scene_response(raw_vlm);
        assert_eq!(anns.len(), 2);

        let updated = engine.merge_vlm_annotations(&mut features, &anns);
        assert_eq!(updated, 2);
        assert!(features[1].is_vlm_verified);
        assert!(features[1].has_hard_subtitle);

        // 基于真实 VLM 视觉摘要语义命中天台追杀镜头
        let matched = engine
            .search_matching_scene(&features, "暴雨夜天台保镖追杀男主的生死时刻", None)
            .expect("should match");
        assert_eq!(matched.scene_id, 2);
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
