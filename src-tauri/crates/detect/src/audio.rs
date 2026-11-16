//! 音轨抽取与字幕辅助工具 (Audio Extraction & Subtitle Helper)

use dramaxis_core::error::DramaxisResult;
use std::path::Path;

impl crate::ffmpeg::Ffmpeg {
    /// 抽取音轨 → wav (16k 单声道, TTS 参考音频标准格式)
    pub async fn extract_audio(&self, input: &Path, output: &Path) -> DramaxisResult<()> {
        self.run_encode(
            &[
                "-i",
                &input.to_string_lossy(),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                &output.to_string_lossy(),
            ],
            None,
        )
        .await
    }
}

/// SRT 字幕生成 helper: (start, end, text) → SRT 文本
pub fn build_srt(entries: &[(f64, f64, String)]) -> String {
    let track = dramaxis_subtitle::SubtitleTrack {
        entries: entries
            .iter()
            .enumerate()
            .map(|(i, (start, end, text))| dramaxis_subtitle::SubtitleEntry {
                index: (i + 1) as u32,
                start_ms: (start.max(0.0) * 1000.0).round() as u64,
                end_ms: (end.max(0.0) * 1000.0).round() as u64,
                text: text.clone(),
                emotion_tag: None,
            })
            .collect(),
        format: dramaxis_subtitle::SubtitleFormat::Srt,
        language: "zh".into(),
    };
    dramaxis_subtitle::formats::to_srt(&track).unwrap_or_default()
}
