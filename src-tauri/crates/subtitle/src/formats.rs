//! dramaxis-subtitle · formats — 字幕格式序列化

use crate::{SubtitleError, SubtitleFormat, SubtitleTrack};

const ASS_HEADER: &str = "[Script Info]\n\
ScriptType: v4.00+\n\
PlayResX: 1080\n\
PlayResY: 1920\n\
\n\
[V4+ Styles]\n\
Format: Name, Fontname, Fontsize, PrimaryColour, Alignment, MarginV\n\
Style: Default,Noto Sans CJK SC,58,&H00FFFFFF,2,120\n\
\n\
[Events]\n\
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

/// 将字幕轨道序列化为 SRT 格式
pub fn to_srt(track: &SubtitleTrack) -> Result<String, SubtitleError> {
    let mut out = String::new();
    for entry in &track.entries {
        let start = ms_to_srt_time(entry.start_ms);
        let end = ms_to_srt_time(entry.end_ms);
        out.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            entry.index, start, end, entry.text
        ));
    }
    Ok(out)
}

/// 将字幕轨道序列化为 WebVTT 格式
pub fn to_vtt(track: &SubtitleTrack) -> Result<String, SubtitleError> {
    let mut out = String::from("WEBVTT\n\n");
    for entry in &track.entries {
        let start = ms_to_vtt_time(entry.start_ms);
        let end = ms_to_vtt_time(entry.end_ms);
        out.push_str(&format!("{} --> {}\n{}\n\n", start, end, entry.text));
    }
    Ok(out)
}

/// 将字幕轨道序列化为 ASS 格式
pub fn to_ass(track: &SubtitleTrack) -> Result<String, SubtitleError> {
    let mut out = String::from(ASS_HEADER);
    for entry in &track.entries {
        let start = ms_to_ass_time(entry.start_ms);
        let end = ms_to_ass_time(entry.end_ms);
        out.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            start, end, entry.text
        ));
    }
    Ok(out)
}

fn ms_to_srt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1_000;
    let ms = ms % 1_000;
    format!("{:02}:{:02}:{:02},{:03}", h, m, s, ms)
}

fn ms_to_vtt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1_000;
    let ms = ms % 1_000;
    format!("{:02}:{:02}:{:02}.{:03}", h, m, s, ms)
}

fn ms_to_ass_time(ms: u64) -> String {
    let cs = ms / 10;
    let (h, rem) = (cs / 360_000, cs % 360_000);
    let (m, rem) = (rem / 6_000, rem % 6_000);
    let (s, cs) = (rem / 100, rem % 100);
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

pub fn serialize(track: &SubtitleTrack) -> Result<String, SubtitleError> {
    match track.format {
        SubtitleFormat::Srt => to_srt(track),
        SubtitleFormat::Vtt => to_vtt(track),
        SubtitleFormat::Ass => to_ass(track),
    }
}
