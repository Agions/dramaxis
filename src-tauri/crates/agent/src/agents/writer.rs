//! 金牌编剧智能体 (ScreenwriterAgent)

use super::{resolve_agent_llm, Agent};
use crate::context::AgentContext;
use crate::types::AgentRole;
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;
use dramaxis_script::LlmRequest;

pub struct ScreenwriterAgent;

#[async_trait]
impl Agent for ScreenwriterAgent {
    fn role(&self) -> AgentRole {
        AgentRole::Screenwriter
    }

    fn name(&self) -> &str {
        "✍️ 金牌编剧 (Screenwriter)"
    }

    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>> {
        let cuts = ctx
            .memory
            .get("scene_count")
            .cloned()
            .unwrap_or_else(|| "4".into());
        let project_name = ctx.project.name.clone();

        let images_base64: Vec<String> = {
            let mut list = Vec::new();
            let paths: Vec<String> = ctx
                .blackboard
                .visual_brief
                .as_ref()
                .map(|v| v.keyframe_paths.clone())
                .or_else(|| {
                    ctx.memory
                        .get("keyframe_paths_json")
                        .and_then(|j| serde_json::from_str(j).ok())
                })
                .unwrap_or_default();

            for p in paths.iter().take(4) {
                if let Ok(bytes) = tokio::fs::read(p).await {
                    use base64::Engine;
                    list.push(base64::engine::general_purpose::STANDARD.encode(&bytes));
                }
            }
            if list.is_empty() {
                if let Some(json_str) = ctx.memory.get("keyframes_base64_json") {
                    list = serde_json::from_str(json_str).unwrap_or_default();
                }
            }
            list
        };

        ctx.log_thought(
            self.role(),
            format!(
                "根据 {} 组视觉分镜 (挂载 {} 张多模态图像) 与【{}】情绪走向，调用 LLM 构思 0~3s 黄金 Hook 悬疑反转独白...",
                cuts, images_base64.len(), project_name
            ),
        );

        let default_script = format!(
            "我万万没想到，在【{}】的背后竟然隐藏着这么大一个局。那天深夜，当我推开这扇门时，才发现所有线索早已被调包。在这关键的几分钟里，真相即将浮出水面...",
            project_name
        );

        let (kind, api_key, model_override, base_url, temperature) =
            resolve_agent_llm(ctx, self.role());

        let final_script = if !api_key.trim().is_empty() {
            let provider = dramaxis_script::factory_custom(kind, api_key.clone(), base_url);

            let video_dur_str = ctx
                .memory
                .get("video_duration")
                .cloned()
                .unwrap_or_else(|| "60.0".into());
            let video_duration: f64 = video_dur_str.parse().unwrap_or(60.0);
            let target_word_count = ((video_duration * 4.3).round() as usize).clamp(40, 1200);

            let shots = ctx
                .blackboard
                .visual_brief
                .as_ref()
                .map(|v| v.shots.clone())
                .unwrap_or_default();

            let shots_instruction = if !shots.is_empty() {
                let mut buf = String::from("\n【镜头级时序分镜指引 (按镜头节奏与画面内容紧密咬合撰写)】:\n");
                for shot in shots.iter().take(8) {
                    buf.push_str(&format!(
                        "- 镜头 {}: {:.1}s~{:.1}s (约{}字, 情绪: {}): {}\n",
                        shot.shot_index,
                        shot.start_time,
                        shot.end_time,
                        shot.target_word_budget,
                        shot.emotion_tag,
                        shot.visual_summary
                    ));
                }
                buf
            } else {
                String::new()
            };

            let critique_feedback = ctx.memory.get("critique_feedback").cloned();
            let critique_instruction = if let Some(fb) = &critique_feedback {
                format!(
                    "\n【⚠️ 剧本质检上一轮打回批注 (本轮必须重点解决以下问题)】:\n{}\n",
                    fb
                )
            } else {
                String::new()
            };

            let system_prompt = format!(
                "你是一名拥有千万播放量的爆款短剧解说与电影编剧。\n\
                【绝对字数与时长红线】\n\
                本段视频有效播放总时长为 {:.1} 秒。按照短剧解说黄金语速（约 4.3 汉字/秒），你的解说词总字数必须严格控制在约 {} 字以内（允许 ±10% 误差），切忌废话与过长台词导致音画失配！\n\
                【多模态视听要求】\n\
                已传入本视频关键帧画面（共 {} 张）。请仔细观察画面中人物的动作、表情、所处环境及发生的冲突事件，以主角第一人称【我】输出 0~3s 抓人眼球的黄金 Hook 以及扣人心弦的高能解说，必须做到每一句话都与镜头画面真实事件严密对应。{}{}",
                video_duration, target_word_count, images_base64.len(), shots_instruction, critique_instruction
            );

            let req = LlmRequest {
                system: system_prompt,
                user: format!(
                    "剧名/工程: {}，场景切片数量: {}，有效总时长: {:.1}s。请结合关键帧视觉画面与镜头时序切片撰写第一人称解说台词，严格控制在约 {} 字以内。{}",
                    project_name, cuts, video_duration, target_word_count,
                    if critique_feedback.is_some() { "【请严格按照质检批注进行悬念反转与节奏修正】" } else { "" }
                ),
                model: model_override,
                max_tokens: Some(1024),
                temperature: Some(temperature),
                stream: false,
                images_base64,
            };

            let mut script_res = None;
            for attempt in 0..=2 {
                match provider.chat(&req).await {
                    Ok(resp) if !resp.content.trim().is_empty() => {
                        script_res = Some(resp.content.trim().to_string());
                        break;
                    }
                    Err(e) => {
                        if attempt < 2 {
                            tokio::time::sleep(tokio::time::Duration::from_millis(
                                500 * (1 << attempt),
                            ))
                            .await;
                        } else {
                            ctx.log_thought(
                                self.role(),
                                format!(
                                    "⚠️ LLM 请求重试耗尽 ({})，自动触发自愈机制加载高质量模板剧本",
                                    e
                                ),
                            );
                        }
                    }
                    _ => break,
                }
            }
            script_res.unwrap_or(default_script)
        } else {
            default_script
        };

        ctx.memory
            .insert("script_text".to_string(), final_script.clone());
        let critique_feedback = ctx.memory.get("critique_feedback").cloned();
        let first_sentence = final_script.lines().next().unwrap_or("").trim().to_string();
        let ver = ctx.blackboard.push_script_version(
            self.role(),
            "第一人称解说台词生成",
            final_script.clone(),
            "conflict",
            first_sentence,
            88.0,
            critique_feedback,
        );

        ctx.log_action(
            self.role(),
            format!("输出多模态剧本文案 (v{})", ver),
            format!(
                "完成 {} 字第一人称剧情独白生成并写入黑板总线",
                final_script.chars().count()
            ),
        );
        Ok(Some(final_script))
    }
}
