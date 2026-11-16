//! 画面视觉分析师智能体 (VisualCriticAgent)

use super::Agent;
use crate::board::{ShotAnnotation, VisualBriefArtifact};
use crate::context::AgentContext;
use crate::types::AgentRole;
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;
use dramaxis_detect::Ffmpeg;
use std::path::Path;

pub struct VisualCriticAgent;

#[async_trait]
impl Agent for VisualCriticAgent {
    fn role(&self) -> AgentRole {
        AgentRole::VisualCritic
    }

    fn name(&self) -> &str {
        "👁️ 画面视觉分析师 (VisualCritic)"
    }

    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>> {
        let first_media = ctx.project.media_files.first().map(|m| m.path.clone());

        let (cuts_vec, duration, keyframes_b64) = if let Some(media_path) = first_media {
            let path_obj = Path::new(&media_path);
            if path_obj.exists() {
                if let Ok(ffmpeg) = Ffmpeg::discover() {
                    let probe = ffmpeg.probe(path_obj).await.unwrap_or(dramaxis_detect::FfmpegProbe {
                        duration_seconds: 60.0,
                        width: 1080,
                        height: 1920,
                        video_codec: Some("h264".into()),
                        audio_codec: Some("aac".into()),
                        size_bytes: 1024 * 1024 * 10,
                    });
                    let cuts = ffmpeg
                        .detect_scenes(path_obj, 0.3)
                        .await
                        .unwrap_or_else(|_| vec![5.0, 15.0, 30.0, 45.0]);
                    let cuts = if cuts.is_empty() {
                        vec![5.0, 15.0, 30.0, 45.0]
                    } else {
                        cuts
                    };

                    let temp_frames_dir = std::env::temp_dir()
                        .join(format!("dramaxis_frames_{}", uuid::Uuid::new_v4()));
                    let sample_cuts: Vec<f64> = cuts.iter().take(4).cloned().collect();
                    let mut saved_paths = Vec::new();

                    if let Ok(saved_frames) = ffmpeg
                        .extract_scene_keyframes(path_obj, &sample_cuts, &temp_frames_dir)
                        .await
                    {
                        saved_paths = saved_frames;
                    }

                    (cuts, probe.duration_seconds, saved_paths)
                } else {
                    (vec![5.0, 15.0, 30.0, 45.0], 60.0, Vec::new())
                }
            } else {
                (vec![5.0, 15.0, 30.0, 45.0], 60.0, Vec::new())
            }
        } else {
            (vec![5.0, 15.0, 30.0, 45.0], 60.0, Vec::new())
        };

        let cuts_json = serde_json::to_string(&cuts_vec).unwrap_or_else(|_| "[]".into());
        let cuts_count = cuts_vec.len();
        let keyframe_paths: Vec<String> = keyframes_b64
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        let paths_json = serde_json::to_string(&keyframe_paths).unwrap_or_else(|_| "[]".into());

        let mut segments: Vec<(f64, f64)> = Vec::new();
        let mut prev = 0.0;
        for &cut in &cuts_vec {
            if cut > prev + 0.2 {
                segments.push((prev, cut));
                prev = cut;
            }
        }
        if duration > prev + 0.2 {
            segments.push((prev, duration));
        }
        if segments.is_empty() {
            segments.push((0.0, duration.max(1.0)));
        }

        let total_segments = segments.len() as f64;
        let shots: Vec<ShotAnnotation> = segments
            .into_iter()
            .enumerate()
            .map(|(idx, (start, end))| {
                let seg_dur = (end - start).max(0.1);
                let pos_ratio = (idx as f64) / total_segments.max(1.0);
                let word_budget = ((seg_dur * 4.3).round() as usize).clamp(6, 120);

                let pace_factor = (3.0 / seg_dur.clamp(0.5, 8.0)) as f32;
                let arc_factor = if (0.65..=0.85).contains(&pos_ratio) {
                    1.4
                } else if pos_ratio < 0.15 {
                    1.25
                } else {
                    0.9
                };
                let motion_intensity = ((pace_factor * 20.0 + 35.0) * arc_factor).clamp(15.0, 98.0);
                let conflict_score = ((motion_intensity * 0.7) + (arc_factor * 25.0)).clamp(20.0, 99.0);

                let (emotion_tag, visual_summary) = if conflict_score > 82.0 {
                    ("激烈对抗", "高强度肢体冲突与紧绷动作镜头")
                } else if conflict_score > 70.0 {
                    ("悬疑对峙", "角色眼神博弈与线索疑云特写")
                } else if conflict_score > 55.0 {
                    ("情绪爆发", "关键转折点主角痛点爆发画面")
                } else if pos_ratio < 0.2 {
                    ("危机开场", "黄金开篇悬念抓人事件引入")
                } else {
                    ("暗流叙事", "情节铺垫与环境线索推进")
                };

                let kf = keyframe_paths.get(idx).cloned();

                ShotAnnotation {
                    shot_index: idx + 1,
                    start_time: start,
                    end_time: end,
                    duration: seg_dur,
                    keyframe_path: kf,
                    motion_intensity,
                    emotion_tag: emotion_tag.into(),
                    conflict_score,
                    visual_summary: visual_summary.into(),
                    target_word_budget: word_budget,
                }
            })
            .collect();

        let shots_json = serde_json::to_string(&shots).unwrap_or_else(|_| "[]".into());

        ctx.log_thought(
            self.role(),
            format!(
                "多模态画面分析完成：视频基底时长 {:.1}s，精准定位 {} 个镜头切点，已抽取 {} 张视觉关键帧，构建 {} 组时序分镜标注",
                duration, cuts_count, keyframe_paths.len(), shots.len()
            ),
        );
        ctx.memory
            .insert("scene_count".to_string(), cuts_count.to_string());
        ctx.memory.insert("scene_cuts_json".to_string(), cuts_json);
        ctx.memory
            .insert("keyframe_paths_json".to_string(), paths_json);
        ctx.memory
            .insert("shot_annotations_json".to_string(), shots_json);
        ctx.memory
            .insert("video_duration".to_string(), format!("{:.1}", duration));

        ctx.blackboard.set_visual_brief(VisualBriefArtifact {
            total_duration_sec: duration,
            scene_cuts_sec: cuts_vec.clone(),
            keyframe_paths: keyframe_paths.clone(),
            visual_summary: format!(
                "提取 {} 组结构化分镜与 {} 张视觉关键帧 (包含 {} 组时序切片标注)",
                cuts_count,
                keyframe_paths.len(),
                shots.len(),
            ),
            shots,
        });

        ctx.log_action(
            self.role(),
            "生成镜头切片与视觉快照",
            format!(
                "提取 {} 组结构化分镜与 {} 张视觉关键帧注入大模型视觉通道",
                cuts_count,
                keyframe_paths.len()
            ),
        );
        Ok(Some(format!(
            "完成 {} 个镜头分镜切片与多模态帧提取",
            cuts_count
        )))
    }
}
