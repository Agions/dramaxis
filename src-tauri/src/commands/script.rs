//! dramaxis v1.1.0 · AI 脚本生成 Tauri 命令

use dramaxis_core::error::SplicrError;
use dramaxis_core::services::ConfigService;
use dramaxis_core::AppContext;
use dramaxis_script::{factory_custom, LlmProviderKind, LlmRequest};
use tauri::State;

#[allow(dead_code)]
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptGenerateParams {
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub prompt: String,
    pub style: Option<String>, // "immersive" | "critic" | "story" | "roast"
    pub emotion_density: Option<f32>,
    pub word_count_target: Option<u32>,
    pub video_duration_sec: Option<f64>,
    pub video_path: Option<String>,
    /// 黄金前3秒爆款钩子策略 ("conflict" | "paradox" | "survival" | "emotion")
    pub hook_style: Option<String>,
    pub include_hook: Option<bool>,
    /// 可选多模态关键帧图片 Base64 数组
    pub images_base64: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptGenerateResult {
    pub text: String,
    pub hook_text: Option<String>,
    pub word_count: usize,
    pub estimated_duration_sec: u32,
}

fn parse_provider(kind: &str) -> LlmProviderKind {
    match kind.to_lowercase().as_str() {
        "qwen" => LlmProviderKind::Qwen,
        "kimi" => LlmProviderKind::Kimi,
        "glm5" => LlmProviderKind::Glm5,
        "claude" => LlmProviderKind::Claude,
        "gemini" => LlmProviderKind::Gemini,
        "deepseek" => LlmProviderKind::DeepSeek,
        "doubao" => LlmProviderKind::Doubao,
        "hunyuan" => LlmProviderKind::Hunyuan,
        "local" => LlmProviderKind::Local,
        "qwen37" => LlmProviderKind::Qwen37,
        _ => LlmProviderKind::OpenAi,
    }
}

#[tauri::command]
pub async fn script_generate(
    app: tauri::AppHandle,
    params: ScriptGenerateParams,
    app_ctx: State<'_, AppContext>,
) -> Result<ScriptGenerateResult, SplicrError> {
    if params.prompt.trim().is_empty() {
        return Err(SplicrError::InvalidInput("提示词不能为空".into()));
    }

    use tauri::Emitter;
    let _ = app.emit("script:token", "[AI 智能体初始化剧情设定...]\n");

    // 自动装配已持久化的设置 (当调用未显式提供凭证时优雅回退)
    let (saved_api_key, saved_base_url, saved_model, saved_provider) =
        if let Ok(cfg_svc) = app_ctx.service::<ConfigService>().await {
            let snap = cfg_svc.snapshot().await;
            (
                snap.llm_api_key,
                snap.llm_base_url,
                snap.llm_model,
                Some(snap.llm_provider.to_string()),
            )
        } else {
            (None, None, None, None)
        };

    let final_provider = params
        .provider
        .or(saved_provider)
        .unwrap_or_else(|| "qwen".into());
    let final_api_key = params.api_key.or(saved_api_key).unwrap_or_default();
    let final_base_url = params.base_url.or(saved_base_url);
    let final_model = params.model.or(saved_model);

    let kind = parse_provider(&final_provider);
    let generator = factory_custom(kind, final_api_key, final_base_url);

    // 探测或适配视频总时长，并推导黄金语速字数预算 (4.2 ~ 4.5 字/秒)
    let mut duration_sec = params.video_duration_sec;
    if duration_sec.is_none() {
        if let Some(ref vpath) = params.video_path {
            let p = std::path::Path::new(vpath);
            if p.exists() {
                if let Ok(ffmpeg) = dramaxis_detect::Ffmpeg::discover() {
                    if let Ok(probe) = ffmpeg.probe(p).await {
                        duration_sec = Some(probe.duration_seconds);
                    }
                }
            }
        }
    }

    let target_words = if let Some(target) = params.word_count_target {
        target
    } else if let Some(dur) = duration_sec {
        ((dur * 4.3).round() as u32).clamp(40, 1500)
    } else {
        300
    };

    // 关键帧视觉多模态数据提取：若未提供 Base64 但提供了视频路径，自动抽取关键帧
    let mut images_base64 = params.images_base64.unwrap_or_default();
    if images_base64.is_empty() {
        if let Some(ref vpath) = params.video_path {
            let p = std::path::Path::new(vpath);
            if p.exists() {
                if let Ok(ffmpeg) = dramaxis_detect::Ffmpeg::discover() {
                    let cuts = ffmpeg
                        .detect_scenes(p, 0.3)
                        .await
                        .unwrap_or_else(|_| vec![3.0, 8.0, 15.0]);
                    let sample_cuts: Vec<f64> = cuts.iter().take(4).cloned().collect();
                    let temp_dir = std::env::temp_dir()
                        .join(format!("dramaxis_script_frames_{}", uuid::Uuid::new_v4()));
                    if let Ok(saved_frames) = ffmpeg
                        .extract_scene_keyframes(p, &sample_cuts, &temp_dir)
                        .await
                    {
                        for frame_path in saved_frames {
                            if let Ok(bytes) = tokio::fs::read(&frame_path).await {
                                use base64::Engine;
                                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                images_base64.push(b64);
                            }
                        }
                    }
                    let _ = tokio::fs::remove_dir_all(temp_dir).await;
                }
            }
        }
    }

    let style_str = params.style.as_deref().unwrap_or("immersive");
    let hook_strategy = params.hook_style.as_deref().unwrap_or("conflict");
    let include_hook = params.include_hook.unwrap_or(true);

    let hook_guidance = if include_hook {
        match hook_strategy {
            "paradox" => "【黄金前3秒钩子：悬念悖论型】开头第1句必须抛出极具反常识的违和行为或设问（如“这个女人不仅当场释放了杀害丈夫的凶手，还宣布要嫁给他…”），用 [HOOK 0~3s] 标记。",
            "survival" => "【黄金前3秒钩子：生存危机型】开头第1句必须制造生死存亡或巨大财产危机的紧迫压迫感，用 [HOOK 0~3s] 标记。",
            "emotion" => "【黄金前3秒钩子：极致情感反差型】开头第1句必须用直击心灵的爱恨情仇反常表现牢牢抓取注意力，用 [HOOK 0~3s] 标记。",
            _ => "【黄金前3秒钩子：激烈冲突型】开头第1句必须直接切入激烈动作对抗、撕破脸面的对峙现场，用 [HOOK 0~3s] 标记。",
        }
    } else {
        ""
    };

    let vision_guidance = if !images_base64.is_empty() {
        format!(
            "\n6. 视听多模态锚定：已为你挂载视频真实关键帧画面（共 {} 张）。请仔细识别画面中发生的动作、人物面部表情与冲突场景，让每一句台词均与画面中真实发生的事件严丝合缝对齐，严禁脱离画面的无端臆造！",
            images_base64.len()
        )
    } else {
        String::new()
    };

    let dur_display = duration_sec
        .map(|d| format!("{:.1}s", d))
        .unwrap_or_else(|| "自适应".into());

    let system_prompt = format!(
        r#"你是一名拥有千万播放爆款短剧解说编剧与影视结构导演。
任务目标：根据给定的视频剧情画面与要求，创作一段节奏飞快、抓耳吸睛、第一人称沉浸式的爆款解说台词文案。

【核心创作法则】
1. 风格模式：{style_str}
2. 目标字数与时长红线：当前视频基底有效时长为 {dur_display}，解说词总字数必须严格控制在约 {target_words} 字以内（短剧黄金语速约 4.3 字/秒，严控字数预算避免音画脱节）
3. 语调基调：去翻译腔、去机械AI味、使用短句、高信息密度
4. 爆款前置：{hook_guidance}
5. 节奏控制：每隔 15~20 秒设置一次小反转或情绪高潮点（可适当使用 [激烈冲突]、[情绪高潮] 等情绪标签）{vision_guidance}

请直接输出剧本正文文本，不要包含任何多余的开场白或解释。"#
    );

    let req = LlmRequest {
        system: system_prompt,
        user: params.prompt.clone(),
        model: final_model,
        max_tokens: Some(2048),
        temperature: Some(0.7),
        stream: false,
        images_base64,
    };

    let resp = generator.chat(&req).await?;

    let text = resp.content;
    let word_count = text.chars().count();
    let estimated_duration_sec = (word_count as u32 / 4).max(10); // 约4字/秒

    // 流式广播完整生成结果
    let _ = app.emit("script:token", &text);

    // 提取 Hook 文本（优先匹配 [HOOK ...] 标记，若无则提取开头第 1 句高光设问）
    let hook_text = if let Some(pos) = text.find("[HOOK") {
        let after = &text[pos..];
        let end_pos = after.find('\n').unwrap_or(after.len());
        Some(after[..end_pos].trim().to_string())
    } else if include_hook {
        // 智能提取首句作为黄金前3秒文案
        let first_sentence = text
            .split(&['。', '！', '？', '\n'][..])
            .next()
            .unwrap_or("")
            .trim();
        if !first_sentence.is_empty() {
            Some(format!("[HOOK 0~3s] {first_sentence}"))
        } else {
            None
        }
    } else {
        None
    };

    Ok(ScriptGenerateResult {
        text,
        hook_text,
        word_count,
        estimated_duration_sec,
    })
}

use dramaxis_script::{HookCandidate, RetentionTensionArc, ScriptFlywheelEngine, StyleProfile};

/// 启发式生成 4 种不同公式的 3 秒 Hook 候选文案 (离线高保真兜底 + 算法赋能)
#[tauri::command]
pub async fn script_generate_hooks(synopsis: String) -> Result<Vec<HookCandidate>, SplicrError> {
    Ok(dramaxis_script::generate_heuristic_hooks(&synopsis))
}

/// 解构对标参考爆款文案，提炼风格画像与 Few-Shot Prompt
#[tauri::command]
pub fn script_deconstruct_reference(text: String) -> Result<StyleProfile, SplicrError> {
    let engine = ScriptFlywheelEngine::new();
    Ok(engine.deconstruct_reference(&text))
}

/// 计算剧本文案留存曲线与四大阶段张力指数
#[tauri::command]
pub fn script_calculate_retention_arc(
    script: String,
    duration_sec: Option<f64>,
) -> Result<RetentionTensionArc, SplicrError> {
    let engine = ScriptFlywheelEngine::new();
    let duration = duration_sec.unwrap_or(60.0);
    Ok(engine.calculate_retention_arc(&script, duration))
}
