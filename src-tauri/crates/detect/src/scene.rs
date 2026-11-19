//! 场景检测、关键帧抽取与高潮切点分析 (Scene Cut & Keyframe Extraction)

use crate::probe::SceneCut;
use dramaxis_core::error::DramaxisResult;
use std::path::{Path, PathBuf};

impl crate::ffmpeg::Ffmpeg {
    /// select+showinfo 场景检测。返回切点时间列表 (秒)。
    pub async fn detect_scenes(
        &self,
        input: &Path,
        threshold: f64,
    ) -> DramaxisResult<Vec<SceneCut>> {
        let filter = format!("select='gt(scene,{threshold})',showinfo");
        let stderr = self
            .run_stderr(
                &[
                    "-i",
                    &input.to_string_lossy(),
                    "-vf",
                    &filter,
                    "-an",
                    "-f",
                    "null",
                    "-",
                ],
                None,
            )
            .await?;
        Ok(parse_scene_lines(&stderr))
    }

    /// 提取单帧关键帧图片为 JPG (指定时间点 timestamp_seconds)
    pub async fn extract_keyframe(
        &self,
        input: &Path,
        timestamp_seconds: f64,
        output: &Path,
    ) -> DramaxisResult<()> {
        let ts = format!("{:.3}", timestamp_seconds);
        self.run_encode(
            &[
                "-ss",
                &ts,
                "-i",
                &input.to_string_lossy(),
                "-vframes",
                "1",
                "-q:v",
                "2",
                &output.to_string_lossy(),
            ],
            None,
        )
        .await
    }

    /// 批量抽取镜头切片关键帧图片，返回保存的图片路径列表
    pub async fn extract_scene_keyframes(
        &self,
        input: &Path,
        cuts: &[SceneCut],
        out_dir: &Path,
    ) -> DramaxisResult<Vec<PathBuf>> {
        let _ = tokio::fs::create_dir_all(out_dir).await;
        let mut paths = Vec::new();
        for (idx, cut) in cuts.iter().enumerate() {
            let out_file = out_dir.join(format!("frame_{:03}.jpg", idx + 1));
            if self.extract_keyframe(input, *cut, &out_file).await.is_ok() {
                paths.push(out_file);
            }
        }
        Ok(paths)
    }

    /// 爆款黄金前3秒：智能评估并萃取最适合作为“高潮前置”的镜头切点 (秒)
    pub fn find_climax_scene<'a>(&self, cuts: &'a [SceneCut]) -> Option<&'a SceneCut> {
        if cuts.is_empty() {
            return None;
        }
        if cuts.len() <= 2 {
            return cuts.last();
        }

        let total_cuts = cuts.len() as f64;
        cuts.iter()
            .enumerate()
            .max_by(|(idx_a, _), (idx_b, _)| {
                let pos_a = *idx_a as f64 / total_cuts;
                let pos_b = *idx_b as f64 / total_cuts;

                let weight_a = 1.0 - (pos_a - 0.75).abs() * 2.0;
                let weight_b = 1.0 - (pos_b - 0.75).abs() * 2.0;

                weight_a
                    .partial_cmp(&weight_b)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(_, cut)| cut)
    }
}

/// 解析 showinfo 输出中的 pts_time (场景切点)
pub fn parse_scene_lines(stderr: &str) -> Vec<SceneCut> {
    let mut cuts = Vec::new();
    for line in stderr.lines() {
        if !line.contains("Parsed_showinfo") {
            continue;
        }
        if let Some(idx) = line.find("pts_time:") {
            let rest = &line[idx + "pts_time:".len()..];
            let num: String = rest
                .chars()
                .take_while(|c| c.is_ascii_digit() || *c == '.')
                .collect();
            if let Ok(t) = num.parse::<f64>() {
                cuts.push(t);
            }
        }
    }
    cuts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    cuts
}

/// 从 ffmpeg 进度行提取 `time=00:00:12.34` → 秒
pub fn extract_time_line(line: &str) -> Option<f64> {
    let idx = line.find("time=")?;
    let rest = &line[idx + 5..];
    let stamp: String = rest.chars().take_while(|c| *c != ' ').collect();
    parse_timestamp(&stamp)
}

/// `HH:MM:SS.xx` → 秒
pub fn parse_timestamp(ts: &str) -> Option<f64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let s: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}
