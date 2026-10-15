//! dramaxis-subtitle · dynamic — 动态字幕：逐字高亮 + 情绪关键词变色

use crate::{SubtitleEntry, SubtitleError};

/// 情绪关键词定义
const EMOTION_KEYWORDS: &[&str] = &[
    "没想到",
    "震惊",
    "愤怒",
    "爱上",
    "痛苦",
    "复仇",
    "真相",
    "秘密",
    "背叛",
    "死亡",
    "绝望",
    "希望",
    "奇迹",
    "突然",
];

/// 为字幕条目添加情绪标签（基于关键词匹配）
pub fn tag_emotion(entry: &mut SubtitleEntry) {
    for keyword in EMOTION_KEYWORDS {
        if entry.text.contains(keyword) {
            entry.emotion_tag = Some(keyword.to_string());
            return;
        }
    }
}

pub fn to_karaoke_ass(entry: &SubtitleEntry) -> Result<String, SubtitleError> {
    let chars: Vec<char> = entry.text.chars().collect();
    let duration_per_char = if chars.is_empty() {
        100u64
    } else {
        entry.end_ms.saturating_sub(entry.start_ms) / chars.len() as u64
    };

    let dur_cs = (duration_per_char / 10).max(1);
    let mut result = String::new();
    for ch in chars {
        result.push_str(&format!("{{\\k{dur_cs}}}{ch}"));
    }
    Ok(result)
}

/// 批量处理字幕条目：标注情绪 + 可选逐字高亮
pub fn process_entries(
    entries: &mut [SubtitleEntry],
    enable_emotion: bool,
) -> Result<(), SubtitleError> {
    for entry in entries.iter_mut() {
        if enable_emotion {
            tag_emotion(entry);
        }
    }
    Ok(())
}
