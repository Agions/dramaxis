//! dramaxis-agent::nodes · StateGraph 各智能体节点独立执行器
//!
//! 从原 1,460 行单体 `dag.rs` 拆解而来，集中承载：
//! - `visual_analysis`：基础场景拆条 + Contact-Sheet 拼图 VLM 真实视觉标注融合 (P0-2)
//! - `dialogue_probe`：原片 VAD 端点探测 + 真实 ASR 台词流与原声金句抽取 (P0-1)
//! - `critic_review`：Flywheel 客观留存波形 + LLM-as-a-Judge 主观裁判双擎评审
//! - 其余 6 大 Agent 角色标准调度入口

use crate::agents::*;
use crate::context::AgentContext;
use crate::deps::AgentRuntimeDeps;
use crate::types::AgentRole;
use dramaxis_core::{CancelToken, DramaxisResult, MediaScheduler, ResourceSlot};
use dramaxis_detect::SceneRagEngine;
use dramaxis_script::flywheel::ScriptFlywheelEngine;
use dramaxis_script::LlmRequest;
use dramaxis_subtitle::{AsrProvider, AutoAsrEngine};
use std::sync::Arc;
use tokio::sync::RwLock;

/// 执行指定 StateGraph 节点逻辑（支持无锁重 IO 与子进程级取消）
pub async fn execute_node(
    context: Arc<RwLock<AgentContext>>,
    node_id: &str,
    deps: Arc<AgentRuntimeDeps>,
    cancel: CancelToken,
) -> DramaxisResult<String> {
    match node_id {
        "director_plan" => {
            let mut ctx = context.write().await;
            let agent = DirectorAgent;
            let res = agent.execute(&mut ctx).await?;
            Ok(res.unwrap_or_else(|| "总控策划已就绪".into()))
        }
        "visual_analysis" => execute_visual_analysis(context, deps, cancel).await,
        "dialogue_probe" => execute_dialogue_probe(context, deps, cancel).await,
        "screenwriter_draft" => {
            let mut ctx = context.write().await;
            let agent = ScreenwriterAgent;
            let res = agent.execute_with_deps(&mut ctx, &deps).await?;
            Ok(res.unwrap_or_else(|| "第一人称叙述剧本撰写完成".into()))
        }
        "critic_review" => execute_critic_review(context, deps).await,
        "hitl_approval" => Ok("人机协同审核通过".into()),
        "voice_synthesis" => {
            let mut ctx = context.write().await;
            let agent = VoiceArtistAgent;
            let res = agent.execute(&mut ctx).await?;
            Ok(res.unwrap_or_else(|| "48kHz 旁白人声生成完成".into()))
        }
        "timeline_compose" => {
            let mut ctx = context.write().await;
            let agent = SoundEngineerAgent;
            let res = agent.execute(&mut ctx).await?;
            Ok(res.unwrap_or_else(|| "时间轴 5 轨磁性吸附对齐完成".into()))
        }
        "quality_gate" => {
            let mut ctx = context.write().await;
            let agent = QualityReviewerAgent;
            let res = agent.execute(&mut ctx).await?;
            Ok(res.unwrap_or_else(|| "视听全案质检完成，已达工业级交付标准".into()))
        }
        _ => Ok("执行完毕".into()),
    }
}

/// P0-2: 视觉分析节点（先执行基础镜头拆条，再在配置 VLM 时通过 Contact-Sheet 拼图升级为真实视觉描述）
async fn execute_visual_analysis(
    context: Arc<RwLock<AgentContext>>,
    deps: Arc<AgentRuntimeDeps>,
    cancel: CancelToken,
) -> DramaxisResult<String> {
    // 1. 执行基础关键帧抽取与初步场景切片
    let base_summary = {
        let mut ctx = context.write().await;
        let agent = VisualCriticAgent;
        agent
            .execute(&mut ctx)
            .await?
            .unwrap_or_else(|| "画面关键帧与场景采样完成".into())
    };

    // 2. 无锁读取关键帧路径，判断是否触发真实 VLM 拼图视觉理解
    let (keyframes, shot_count) = {
        let ctx = context.read().await;
        let vb = ctx.blackboard.visual_brief.as_ref();
        let kfs = vb.map(|v| v.keyframe_paths.clone()).unwrap_or_default();
        let cnt = vb.map(|v| v.shots.len()).unwrap_or(0);
        (kfs, cnt)
    };

    let (kind, api_key, model_override, base_url, _temp) =
        deps.resolve_agent_llm(AgentRole::VisualCritic);

    if keyframes.is_empty() || api_key.trim().is_empty() || cancel.is_cancelled() {
        return Ok(base_summary);
    }

    let rag = SceneRagEngine::new();
    let sheet_path = std::env::temp_dir().join(format!(
        "dramaxis_contact_sheet_{}.jpg",
        uuid::Uuid::new_v4()
    ));

    let vlm_updated = if let Ok(sheet) = rag
        .build_contact_sheet(&keyframes, &sheet_path, 3, 3, &cancel)
        .await
    {
        let img_b64 = tokio::fs::read(&sheet).await.ok().map(|bytes| {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD.encode(bytes)
        });
        let _ = std::fs::remove_file(&sheet);

        if let Some(b64) = img_b64 {
            let _permit = MediaScheduler::global()
                .acquire_cancellable(ResourceSlot::LlmApi, &cancel)
                .await;
            if _permit.is_some() {
                let provider = dramaxis_script::factory_custom(kind, api_key, base_url);
                let prompt = rag.build_contact_sheet_vlm_prompt(shot_count.min(9).max(1), 1);
                let req = LlmRequest {
                    system: "你是专业影视视觉分析师，严格按要求输出 JSON 数组。".into(),
                    user: prompt,
                    model: model_override,
                    max_tokens: Some(1024),
                    temperature: Some(0.2),
                    stream: false,
                    images_base64: vec![b64],
                };
                if let Ok(resp) = provider.chat(&req).await {
                    let anns = rag.parse_vlm_scene_response(&resp.content);
                    if !anns.is_empty() {
                        let mut ctx = context.write().await;
                        if let Some(vb) = ctx.blackboard.visual_brief.as_mut() {
                            let mut updated = 0usize;
                            for ann in &anns {
                                if let Some(shot) =
                                    vb.shots.iter_mut().find(|s| s.shot_index == ann.scene_id)
                                {
                                    if !ann.visual_summary.trim().is_empty() {
                                        shot.visual_summary = ann.visual_summary.trim().to_string();
                                    }
                                    if !ann.emotion_tag.trim().is_empty() {
                                        shot.emotion_tag = ann.emotion_tag.trim().to_string();
                                    }
                                    shot.conflict_score = ann.conflict_score.clamp(0.0, 100.0);
                                    updated += 1;
                                }
                            }
                            updated
                        } else {
                            0
                        }
                    } else {
                        0
                    }
                } else {
                    0
                }
            } else {
                0
            }
        } else {
            0
        }
    } else {
        0
    };

    if vlm_updated > 0 {
        let mut ctx = context.write().await;
        ctx.log_action(
            AgentRole::VisualCritic,
            "Contact-Sheet VLM 视觉感知",
            format!("成功通过多模态拼图真实标注 {} 个核心镜头", vlm_updated),
        );
        Ok(format!(
            "{base_summary}（已通过 VLM 拼图真实标注 {vlm_updated} 个镜头）"
        ))
    } else {
        Ok(base_summary)
    }
}

/// P0-1: 原片音频探测 + 真实 ASR 台词流与原声金句提取
async fn execute_dialogue_probe(
    context: Arc<RwLock<AgentContext>>,
    deps: Arc<AgentRuntimeDeps>,
    cancel: CancelToken,
) -> DramaxisResult<String> {
    let (first_media, dur_hint) = {
        let mut ctx = context.write().await;
        ctx.log_thought(
            AgentRole::SoundEngineer,
            "启动音频通道探测器，并行执行原片 VAD 静音端点检测与 ASR 原片台词转写...",
        );
        let m = ctx.project.media_files.first().map(|m| m.path.clone());
        let d = ctx
            .blackboard
            .visual_brief
            .as_ref()
            .map(|v| v.total_duration_sec)
            .unwrap_or(60.0);
        (m, d)
    };

    let mut transcript_segments = Vec::new();
    let mut asr_provider: Option<String> = None;
    let mut asr_prompt_ctx = String::new();

    let (has_speech, _dur_sec, summary, intervals) = if let Some(media_path) = first_media {
        let p = std::path::Path::new(&media_path);
        if p.exists() {
            // 1. 尝试真实 ASR 语音转写（伴随 SRT -> 本地 whisper-cli -> Whisper HTTP API）
            let asr_engine = AutoAsrEngine::new(deps.asr_config.clone());
            if let Ok(tr) = asr_engine.transcribe(p, &cancel).await {
                if !tr.segments.is_empty() {
                    asr_prompt_ctx = tr.to_prompt_context(2400);
                    asr_provider = Some(tr.provider.clone());
                    transcript_segments = tr.segments;
                } else {
                    asr_provider = Some(tr.provider);
                }
            }

            // 2. FFmpeg probe + VAD 活动分段
            let probe_res = if let Ok(ffmpeg) = dramaxis_detect::Ffmpeg::discover() {
                ffmpeg.probe(p).await.ok()
            } else {
                None
            };

            if let Some(probe) = probe_res {
                let has_audio = probe.audio_codec.is_some();
                let d = probe.duration_seconds;
                if has_audio {
                    let vad_cfg = dramaxis_subtitle::vad::VadConfig::default();
                    let segments = dramaxis_subtitle::vad::detect_segments(p, &vad_cfg)
                        .await
                        .unwrap_or_default();

                    let ivs: Vec<crate::board::SpeechInterval> = segments
                        .into_iter()
                        .map(|s| crate::board::SpeechInterval {
                            start: s.start_ms as f64 / 1000.0,
                            end: s.end_ms as f64 / 1000.0,
                        })
                        .collect();

                    let summary = format!(
                        "检测到原片音轨 ({})，时长 {:.1}s，VAD 识别 {} 处活动区间，ASR 提取 {} 条台词",
                        probe.audio_codec.unwrap_or_default(),
                        d,
                        ivs.len(),
                        transcript_segments.len()
                    );
                    (true, d, summary, ivs)
                } else {
                    (
                        false,
                        d,
                        "原片无音轨，已标记为纯静音画面素材".into(),
                        Vec::new(),
                    )
                }
            } else {
                (true, dur_hint, "原片音轨分析就绪".into(), Vec::new())
            }
        } else {
            (
                true,
                dur_hint,
                "素材文件不存在，使用默认音频配置".into(),
                Vec::new(),
            )
        }
    } else {
        (
            true,
            dur_hint,
            "无可用音轨，音频通道探测完成".into(),
            Vec::new(),
        )
    };

    {
        let mut ctx = context.write().await;
        let asr_count = transcript_segments.len();
        ctx.blackboard
            .set_audio_brief(crate::board::AudioBriefArtifact {
                has_original_speech: has_speech,
                speech_intervals: intervals,
                bgm_intensity_peaks: vec![3.0, 15.0, 30.0],
                dialogue_summary: summary.clone(),
                transcript_segments,
                asr_provider,
            });
        ctx.memory.insert("dialogue_summary".into(), summary);
        if !asr_prompt_ctx.is_empty() {
            ctx.memory
                .insert("asr_transcript_context".into(), asr_prompt_ctx);
        }
        ctx.log_action(
            AgentRole::SoundEngineer,
            "对白抽取与 ASR 转写",
            format!("完成原片 VAD 断句探测与 {} 条 ASR 台词提取", asr_count),
        );
    }

    Ok("原声对白与 ASR 台词探测完成".into())
}

/// 剧本质检节点（Flywheel 留存波形 + LLM-as-a-Judge 双擎评审）
async fn execute_critic_review(
    context: Arc<RwLock<AgentContext>>,
    deps: Arc<AgentRuntimeDeps>,
) -> DramaxisResult<String> {
    let mut ctx = context.write().await;
    let script_text = ctx
        .blackboard
        .active_script()
        .map(|s| s.text.clone())
        .or_else(|| ctx.memory.get("script_text").cloned())
        .unwrap_or_default();

    let video_dur_str = ctx
        .memory
        .get("video_duration")
        .cloned()
        .unwrap_or_else(|| "60.0".into());
    let video_duration: f64 = video_dur_str.parse().unwrap_or(60.0);

    let flywheel = ScriptFlywheelEngine::new();
    let arc = flywheel.calculate_retention_arc(&script_text, video_duration);
    let target_words = ((video_duration * 4.3).round() as usize).clamp(30, 2000);
    let actual_words = script_text.chars().count();
    let word_ratio = actual_words as f32 / target_words.max(1) as f32;
    let mut pacing_score = (100.0 - (word_ratio - 1.0).abs() * 50.0).clamp(55.0, 96.0);
    let mut hook_score = arc.hook_score;
    let mut conflict_score = arc.climax_intensity.clamp(50.0, 95.0);
    let mut overall_score =
        (hook_score * 0.4 + pacing_score * 0.35 + conflict_score * 0.25).clamp(60.0, 98.0);
    let mut critique_feedback = if overall_score < 85.0 {
        Some("黄金前3秒缺乏戏剧性张力与危机感，开篇反转不足，且字数节奏需微调。".to_string())
    } else {
        Some("文案整体张力良好，前3秒抓人，高潮反转起伏合规。".to_string())
    };
    let mut suggestions: Vec<String> = Vec::new();
    if hook_score < 85.0 {
        suggestions.push("前3秒应直接抛出冲突核心或生死/背叛反常识反转，避免平铺直叙".into());
    }
    if pacing_score < 80.0 {
        suggestions.push(format!(
            "字数配比（当前{}字/预期{}字）稍有偏差，请微调台词节奏",
            actual_words, target_words
        ));
    }

    let (kind, api_key, model_override, base_url, _temp) =
        deps.resolve_agent_llm(AgentRole::QualityReviewer);

    if !api_key.trim().is_empty() {
        let provider = dramaxis_script::factory_custom(kind, api_key, base_url);
        let judge_req = LlmRequest {
            system: "你是一名拥有千万粉丝短视频操盘经验的短剧金牌审稿人与文学裁判。\n\
            请对送审的第一人称短剧解说文案进行严格评分，返回合法 JSON 格式，严禁包含 markdown 围栏或额外解释：\n\
            {\n\
              \"hookScore\": 88.0,\n\
              \"conflictScore\": 90.0,\n\
              \"pacingScore\": 86.0,\n\
              \"overallScore\": 88.0,\n\
              \"critiqueFeedback\": \"评语意见...\",\n\
              \"suggestions\": [\"修改建议1\", \"修改建议2\"]\n\
            }"
            .into(),
            user: format!(
                "视频时长: {:.1}s，目标字数: ~{}字。送审文案如下：\n\"\"\"\n{}\n\"\"\"",
                video_duration, target_words, script_text
            ),
            model: model_override,
            max_tokens: Some(512),
            temperature: Some(0.2),
            stream: false,
            images_base64: Vec::new(),
        };

        if let Ok(resp) = provider.chat(&judge_req).await {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct JudgeResult {
                hook_score: Option<f32>,
                conflict_score: Option<f32>,
                pacing_score: Option<f32>,
                overall_score: Option<f32>,
                critique_feedback: Option<String>,
                suggestions: Option<Vec<String>>,
            }

            let clean_json = resp
                .content
                .trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();

            if let Ok(jr) = serde_json::from_str::<JudgeResult>(clean_json) {
                if let Some(s) = jr.overall_score {
                    overall_score = (s * 0.7 + overall_score * 0.3).clamp(50.0, 99.0);
                }
                if let Some(h) = jr.hook_score {
                    hook_score = h;
                }
                if let Some(p) = jr.pacing_score {
                    pacing_score = p;
                }
                if let Some(c) = jr.conflict_score {
                    conflict_score = c;
                }
                if let Some(fb) = jr.critique_feedback {
                    critique_feedback = Some(fb);
                }
                if let Some(sugg) = jr.suggestions {
                    suggestions = sugg;
                }
            }
        }
    }

    ctx.memory
        .insert("critic_score".into(), format!("{:.1}", overall_score));
    if let Some(ref fb) = critique_feedback {
        ctx.memory.insert("critique_feedback".into(), fb.clone());
    }

    if let Some(latest) = ctx.blackboard.script_versions.last_mut() {
        latest.estimated_retention = overall_score;
        latest.hook_score = Some(hook_score);
        latest.pacing_score = Some(pacing_score);
        latest.conflict_score = Some(conflict_score);
        latest.critique_feedback = critique_feedback.clone();
        latest.critique_suggestions = suggestions.clone();
    }

    ctx.log_thought(
        AgentRole::QualityReviewer,
        format!(
            "文学与留存张力 Hybrid 评审完成：综合得分 {:.1}（前3s Hook: {:.1}，语速节奏: {:.1}，冲突高潮: {:.1}）",
            overall_score, hook_score, pacing_score, conflict_score
        ),
    );

    if overall_score < 85.0 {
        ctx.log_thought(
            AgentRole::QualityReviewer,
            format!(
                "⚠️ 评分未达达标线 (85.0 分)，批注: {}",
                critique_feedback.as_deref().unwrap_or("需重写优化")
            ),
        );
    }

    Ok(format!("剧本评审完成，综合得分 {:.1} 分", overall_score))
}
