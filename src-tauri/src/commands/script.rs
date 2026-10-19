//! dramaxis v1.1.0 · AI 脚本生成 Tauri 命令

use dramaxis_core::error::SplicrError;
use dramaxis_script::{factory, LlmProviderKind, LlmRequest};

#[allow(dead_code)]
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptGenerateParams {
    pub provider: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub prompt: String,
    pub style: Option<String>, // "immersive" | "critic" | "story" | "roast"
    pub emotion_density: Option<f32>,
    pub word_count_target: Option<u32>,
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
) -> Result<ScriptGenerateResult, SplicrError> {
    if params.prompt.trim().is_empty() {
        return Err(SplicrError::InvalidInput("提示词不能为空".into()));
    }

    use tauri::Emitter;
    let _ = app.emit("script:token", "[AI 智能体初始化剧情设定...]\n");

    let kind = parse_provider(&params.provider);
    let api_key = params.api_key.unwrap_or_default();
    let generator = factory(kind, api_key);

    let style_str = params.style.as_deref().unwrap_or("immersive");
    let target_words = params.word_count_target.unwrap_or(800);
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

    let system_prompt = format!(
        r#"你是一名拥有千万播放爆款短剧解说编剧与影视结构导演。
任务目标：根据给定的视频剧情画面与要求，创作一段节奏飞快、抓耳吸睛、第一人称沉浸式的爆款解说台词文案。

【核心创作法则】
1. 风格模式：{style_str}
2. 目标字数：严格控制在 {target_words} 字左右
3. 语调基调：去翻译腔、去机械AI味、使用短句、高信息密度
4. 爆款前置：{hook_guidance}
5. 节奏控制：每隔 15~20 秒设置一次小反转或情绪高潮点（可适当使用 [激烈冲突]、[情绪高潮] 等情绪标签）

请直接输出剧本正文文本，不要包含任何多余的开场白或解释。"#
    );

    let req = LlmRequest {
        system: system_prompt,
        user: params.prompt.clone(),
        model: params.model.clone(),
        max_tokens: Some(2048),
        temperature: Some(0.7),
        stream: false,
        images_base64: params.images_base64.unwrap_or_default(),
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

use dramaxis_script::HookCandidate;

/// 启发式生成 4 种不同公式的 3 秒 Hook 候选文案 (离线高保真兜底 + 算法赋能)
#[tauri::command]
pub async fn script_generate_hooks(
    synopsis: String,
) -> Result<Vec<HookCandidate>, SplicrError> {
    Ok(dramaxis_script::generate_heuristic_hooks(&synopsis))
}

