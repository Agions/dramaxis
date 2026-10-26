//! dramaxis v1.1.0 · TTS 试听与合成 Tauri 命令

use dramaxis_core::error::SplicrError;
use dramaxis_core::services::ConfigService;
use dramaxis_core::AppContext;
use dramaxis_voice::{
    engine, EdgeTtsOptions, GptSovitsOptions, MimoTtsOptions, OpenAiTtsOptions, TtsEngineConfig,
    TtsRequest,
};
use std::path::PathBuf;
use tauri::Manager;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoicePreviewParams {
    pub text: String,
    pub provider: String, // "edge" | "open-ai" | "mimo" | "gpt-sovits" | "mossland" | "custom"
    pub voice: Option<String>,
    pub rate_percent: i32,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub ref_audio_path: Option<String>,
    pub prompt_text: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoicePreviewResult {
    pub file_path: String,
    pub format: String,
    pub bytes_written: u64,
}

fn build_tts_engine(params: &VoicePreviewParams) -> Box<dyn dramaxis_voice::TtsEngine> {
    let config = match params.provider.as_str() {
        "mossland" => TtsEngineConfig::OpenAi(OpenAiTtsOptions {
            api_key: params.api_key.clone().unwrap_or_default(),
            base_url: params
                .base_url
                .clone()
                .filter(|u| !u.trim().is_empty())
                .unwrap_or_else(|| "https://api.mossland.studio/v1".into()),
            model: params
                .model
                .clone()
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| "moss-tts-v1".into()),
            voice: params
                .voice
                .clone()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "moss-narrator-male".into()),
        }),
        "custom" | "open-ai" => TtsEngineConfig::OpenAi(OpenAiTtsOptions {
            api_key: params.api_key.clone().unwrap_or_default(),
            base_url: params
                .base_url
                .clone()
                .filter(|u| !u.trim().is_empty())
                .unwrap_or_else(|| "https://api.openai.com/v1".into()),
            model: params
                .model
                .clone()
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| "tts-1".into()),
            voice: params
                .voice
                .clone()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "alloy".into()),
        }),
        "mimo" => TtsEngineConfig::Mimo(MimoTtsOptions {
            api_key: params.api_key.clone().unwrap_or_default(),
            base_url: params
                .base_url
                .clone()
                .unwrap_or_else(|| "https://api.minimax.chat/v1".into()),
            model: params
                .model
                .clone()
                .unwrap_or_else(|| "speech-02-hd".into()),
            voice: params
                .voice
                .clone()
                .unwrap_or_else(|| "male-qn-qingse".into()),
        }),
        "gpt-sovits" => TtsEngineConfig::GptSovits(GptSovitsOptions {
            base_url: params
                .base_url
                .clone()
                .unwrap_or_else(|| "http://127.0.0.1:9880".into()),
            ref_audio_path: params.ref_audio_path.clone().unwrap_or_default(),
            prompt_text: params.prompt_text.clone().unwrap_or_default(),
            prompt_lang: "zh".into(),
        }),
        _ => TtsEngineConfig::Edge(EdgeTtsOptions {
            voice: params
                .voice
                .clone()
                .unwrap_or_else(|| "zh-CN-YunxiNeural".into()),
        }),
    };
    engine(config)
}

/// 快捷试听生成: 将试听文本生成音频并存入 App 临时缓存目录 `~/.dramaxis/cache/tts/`
#[tauri::command]
pub async fn voice_preview(
    app_handle: tauri::AppHandle,
    params: VoicePreviewParams,
) -> Result<VoicePreviewResult, SplicrError> {
    if params.text.trim().is_empty() {
        return Err(SplicrError::InvalidInput("试听文本不能为空".into()));
    }

    // 回退已保存的配置
    let (saved_api_key, saved_base_url, saved_voice, saved_model) =
        if let Ok(cfg_svc) = app_handle.state::<AppContext>().service::<ConfigService>().await {
            let snap = cfg_svc.snapshot().await;
            (
                snap.tts_api_key,
                snap.tts_base_url,
                snap.tts_voice,
                snap.tts_model,
            )
        } else {
            (None, None, None, None)
        };

    let resolved_params = VoicePreviewParams {
        text: params.text,
        provider: params.provider,
        voice: params.voice.or(saved_voice),
        rate_percent: params.rate_percent,
        api_key: params.api_key.or(saved_api_key),
        base_url: params.base_url.or(saved_base_url),
        model: params.model.or(saved_model),
        ref_audio_path: params.ref_audio_path,
        prompt_text: params.prompt_text,
    };

    // 默认缓存目录
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| PathBuf::from("/tmp/dramaxis/cache"));
    let tts_cache_dir = cache_dir.join("tts");
    tokio::fs::create_dir_all(&tts_cache_dir)
        .await
        .map_err(|e| SplicrError::Io(format!("创建 TTS 缓存目录失败: {e}")))?;

    let file_id = chrono::Utc::now().timestamp_millis();
    let ext = if resolved_params.provider == "gpt-sovits" {
        "wav"
    } else {
        "mp3"
    };
    let output_path = tts_cache_dir.join(format!("preview_{file_id}.{ext}"));

    let tts_engine = build_tts_engine(&resolved_params);
    let outcome = tts_engine
        .synthesize(&TtsRequest {
            text: resolved_params.text.clone(),
            voice: resolved_params.voice.clone(),
            rate_percent: resolved_params.rate_percent,
            output_path: output_path.clone(),
        })
        .await
        .map_err(|e| SplicrError::Tts(format!("TTS 试听合成失败: {e}")))?;

    Ok(VoicePreviewResult {
        file_path: output_path.to_string_lossy().to_string(),
        format: outcome.format.to_string(),
        bytes_written: outcome.bytes_written,
    })
}

/// 完整配音合成导出: 将文本合成至指定目标文件路径
#[tauri::command]
pub async fn voice_synthesize(
    app_handle: tauri::AppHandle,
    params: VoicePreviewParams,
    output_path: String,
) -> Result<VoicePreviewResult, SplicrError> {
    if params.text.trim().is_empty() {
        return Err(SplicrError::InvalidInput("合成文本不能为空".into()));
    }

    // 回退已保存的配置
    let (saved_api_key, saved_base_url, saved_voice, saved_model) =
        if let Ok(cfg_svc) = app_handle.state::<AppContext>().service::<ConfigService>().await {
            let snap = cfg_svc.snapshot().await;
            (
                snap.tts_api_key,
                snap.tts_base_url,
                snap.tts_voice,
                snap.tts_model,
            )
        } else {
            (None, None, None, None)
        };

    let resolved_params = VoicePreviewParams {
        text: params.text,
        provider: params.provider,
        voice: params.voice.or(saved_voice),
        rate_percent: params.rate_percent,
        api_key: params.api_key.or(saved_api_key),
        base_url: params.base_url.or(saved_base_url),
        model: params.model.or(saved_model),
        ref_audio_path: params.ref_audio_path,
        prompt_text: params.prompt_text,
    };

    let out_path = PathBuf::from(&output_path);

    let tts_engine = build_tts_engine(&resolved_params);
    let outcome = tts_engine
        .synthesize(&TtsRequest {
            text: resolved_params.text.clone(),
            voice: resolved_params.voice.clone(),
            rate_percent: resolved_params.rate_percent,
            output_path: out_path.clone(),
        })
        .await
        .map_err(|e| SplicrError::Tts(format!("TTS 完整合成失败: {e}")))?;

    Ok(VoicePreviewResult {
        file_path: out_path.to_string_lossy().to_string(),
        format: outcome.format.to_string(),
        bytes_written: outcome.bytes_written,
    })
}
