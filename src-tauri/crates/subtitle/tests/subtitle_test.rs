use splicr_subtitle::dynamic::{process_entries, to_karaoke_ass};
use splicr_subtitle::formats::{serialize, to_ass, to_srt, to_vtt};
use splicr_subtitle::{SubtitleEntry, SubtitleFormat, SubtitleTrack};

fn sample_track(format: SubtitleFormat) -> SubtitleTrack {
    SubtitleTrack {
        entries: vec![
            SubtitleEntry {
                index: 1,
                start_ms: 1500,
                end_ms: 4200,
                text: "所有人以为我死了".into(),
                emotion_tag: None,
            },
            SubtitleEntry {
                index: 2,
                start_ms: 4500,
                end_ms: 8000,
                text: "但我回来了".into(),
                emotion_tag: None,
            },
        ],
        format,
        language: "zh-CN".into(),
    }
}

#[test]
fn test_to_srt_format() {
    let track = sample_track(SubtitleFormat::Srt);
    let srt = to_srt(&track).expect("SRT generation failed");

    assert!(srt.contains("1\n00:00:01,500 --> 00:00:04,200\n所有人以为我死了\n\n"));
    assert!(srt.contains("2\n00:00:04,500 --> 00:00:08,000\n但我回来了\n\n"));
}

#[test]
fn test_to_vtt_format() {
    let track = sample_track(SubtitleFormat::Vtt);
    let vtt = to_vtt(&track).expect("VTT generation failed");

    assert!(vtt.starts_with("WEBVTT\n\n"));
    assert!(vtt.contains("00:00:01.500 --> 00:00:04.200\n所有人以为我死了\n\n"));
}

#[test]
fn test_to_ass_format() {
    let track = sample_track(SubtitleFormat::Ass);
    let ass = to_ass(&track).expect("ASS generation failed");

    assert!(ass.contains("[Script Info]"));
    assert!(ass.contains("[V4+ Styles]"));
    assert!(ass.contains("Dialogue: 0,0:00:01.50,0:00:04.20,Default,,0,0,0,,所有人以为我死了\n"));
    assert!(ass.contains("Dialogue: 0,0:00:04.50,0:00:08.00,Default,,0,0,0,,但我回来了\n"));
}

#[test]
fn test_serialize_dispatcher() {
    let srt_track = sample_track(SubtitleFormat::Srt);
    let ass_track = sample_track(SubtitleFormat::Ass);
    let vtt_track = sample_track(SubtitleFormat::Vtt);

    assert!(serialize(&srt_track).unwrap().contains("-->"));
    assert!(serialize(&vtt_track).unwrap().starts_with("WEBVTT"));
    assert!(serialize(&ass_track).unwrap().contains("[Script Info]"));
}

#[test]
fn test_karaoke_ass_calculation() {
    let entry = SubtitleEntry {
        index: 1,
        start_ms: 0,
        end_ms: 800, // 800ms total, 8 chars => 100ms per char => 10 centiseconds
        text: "一二三四五六七八".into(),
        emotion_tag: None,
    };

    let karaoke = to_karaoke_ass(&entry).expect("Karaoke generation failed");
    // Each character should have \k10 (100ms = 10cs)
    assert_eq!(
        karaoke,
        "{\\k10}一{\\k10}二{\\k10}三{\\k10}四{\\k10}五{\\k10}六{\\k10}七{\\k10}八"
    );
}

#[test]
fn test_process_entries_emotion_tagging() {
    let mut entries = vec![
        SubtitleEntry {
            index: 1,
            start_ms: 0,
            end_ms: 2000,
            text: "他感到无比愤怒并咆哮".into(),
            emotion_tag: None,
        },
        SubtitleEntry {
            index: 2,
            start_ms: 2500,
            end_ms: 4000,
            text: "今天天气很好".into(),
            emotion_tag: None,
        },
    ];

    process_entries(&mut entries, true).expect("Emotion processing failed");
    assert_eq!(entries[0].emotion_tag, Some("愤怒".to_string()));
    assert_eq!(entries[1].emotion_tag, None);
}
