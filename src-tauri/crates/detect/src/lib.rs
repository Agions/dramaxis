//! dramaxis-detect v1.0.0 · 智能拆条与视觉检测
//!
//! ## 模块划分 (严格遵循文件名 <= 8 字母规范)
//! - `ffmpeg`: 二进制发现 (`ffmpeg` / `ffprobe` PATH 探测与进程执行) (ffmpeg.rs)
//! - `probe`: 媒体探针与硬件加速识别 (probe.rs)
//! - `scene`: 场景检测与关键帧抽取 (scene.rs)
//! - `audio`: 音轨抽取与字幕辅助工具 (audio.rs)
//! - `multimodal`: 跨模态 Scene-RAG 向量检索

pub mod audio;
pub mod ffmpeg;
pub mod multi;
pub use multi as multimodal;
pub mod probe;
pub mod scene;

pub use audio::*;
pub use ffmpeg::*;
pub use multi::{SceneRagEngine, SceneVisualFeature};
pub use probe::*;
pub use scene::*;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn parse_probe_json_full() {
        let json = r#"{
            "streams": [
                {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080},
                {"codec_type": "audio", "codec_name": "aac"}
            ],
            "format": {"duration": "123.456", "size": "9999"}
        }"#;
        let p = parse_probe_json(json).unwrap();
        assert_eq!(p.duration_seconds, 123.456);
        assert_eq!(p.width, 1920);
        assert_eq!(p.height, 1080);
        assert_eq!(p.video_codec.as_deref(), Some("h264"));
        assert_eq!(p.audio_codec.as_deref(), Some("aac"));
        assert_eq!(p.size_bytes, 9999);
    }

    #[test]
    fn parse_scene_lines_extracts_sorted() {
        let stderr = "[Parsed_showinfo_1 @ 0x1] n:0 pts:100 pts_time:12.5 \n\
                      [Parsed_showinfo_1 @ 0x1] n:1 pts:50 pts_time:3.2 \n\
                      unrelated line";
        let cuts = parse_scene_lines(stderr);
        assert_eq!(cuts, vec![3.2, 12.5]);
    }

    #[test]
    fn parse_timestamp_and_time_line() {
        assert_eq!(parse_timestamp("00:01:30.50"), Some(90.5));
        assert_eq!(
            extract_time_line("frame=10 fps=5 time=00:00:12.34 bitrate=1x"),
            Some(12.34)
        );
        assert_eq!(extract_time_line("no progress here"), None);
    }

    #[test]
    fn build_srt_format() {
        let srt = build_srt(&[(0.0, 2.5, "你好".into()), (2.5, 5.0, "世界".into())]);
        assert!(srt.contains("1\n00:00:00,000 --> 00:00:02,500\n你好"));
        assert!(srt.contains("2\n00:00:02,500 --> 00:00:05,000\n世界"));
    }

    #[tokio::test]
    async fn probe_missing_file_errors() {
        if let Ok(f) = Ffmpeg::discover() {
            let r = f.probe(Path::new("/nonexistent/video.mp4")).await;
            assert!(r.is_err());
        }
    }
}
