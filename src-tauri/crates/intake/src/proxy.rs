//! dramaxis-intake::proxy · 代理剪辑 (720p GOP=15 Proxy) 与音频波形峰值缓存引擎
//!
//! ## 核心目标 (P1-3)
//! 1. 为 4K / 高码率 / 多集大视频生成轻量化 720p 关键帧密集型（GOP=15）代理流，消除 WebView 拖拽卡顿；
//! 2. 预计算归一化音频波形峰值 `.peaks.json`，供时间轴 Canvas 零延迟渲染；
//! 3. 基于文件头尾采样 + 尺寸的毫秒级内容指纹去重，并内置可配置上限的 LRU 磁盘自动回收。

use dramaxis_core::{CancelToken, MediaScheduler, ResourceSlot};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tokio::process::Command;

/// 代理视频生成与缓存回收配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    /// 代理视频最大高度（默认 720p）
    pub max_height: u32,
    /// 关键帧间隔 GOP（默认 15，保障毫秒级精确 Seek）
    pub gop_size: u32,
    /// H.264 CRF 画质参数（默认 28，兼顾体积与监看清晰度）
    pub crf: u8,
    /// 缓存目录磁盘上限（默认 20 GB）
    pub max_cache_bytes: u64,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            max_height: 720,
            gop_size: 15,
            crf: 28,
            max_cache_bytes: 20 * 1024 * 1024 * 1024,
        }
    }
}

/// 代理视频生成结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyArtifact {
    pub proxy_path: PathBuf,
    pub cache_hit: bool,
    pub fingerprint: String,
}

/// 归一化音频波形峰值缓存结构
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPeaks {
    pub fingerprint: String,
    pub buckets: usize,
    pub peaks: Vec<f32>,
}

/// 快速文件指纹（文件大小 + 头尾 4KB 采样哈希，4GB 视频亦可 < 1ms 完成）
pub fn compute_fast_fingerprint(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| format!("打开素材失败: {e}"))?;
    let meta = file
        .metadata()
        .map_err(|e| format!("读取元数据失败: {e}"))?;
    let len = meta.len();

    let mut hasher = DefaultHasher::new();
    len.hash(&mut hasher);

    let mut buf = [0u8; 4096];
    let head_n = file.read(&mut buf).unwrap_or(0);
    buf[..head_n].hash(&mut hasher);

    if len > 4096 {
        let _ = file.seek(SeekFrom::End(-4096));
        let tail_n = file.read(&mut buf).unwrap_or(0);
        buf[..tail_n].hash(&mut hasher);
    }

    Ok(format!("{:016x}_{len}", hasher.finish()))
}

/// 生成或复用 720p GOP=15 代理剪辑视频（受 `MediaScheduler` 并发背压与 `CancelToken` 即时取消保护）
pub async fn generate_proxy_video(
    source_path: &Path,
    cache_dir: &Path,
    config: &ProxyConfig,
    cancel: &CancelToken,
) -> Result<ProxyArtifact, String> {
    if !source_path.exists() {
        return Err(format!("原片文件不存在: {:?}", source_path));
    }
    let _ = std::fs::create_dir_all(cache_dir);
    let fp = compute_fast_fingerprint(source_path)?;
    let proxy_path = cache_dir.join(format!("{fp}_proxy.mp4"));

    if proxy_path.exists() {
        return Ok(ProxyArtifact {
            proxy_path,
            cache_hit: true,
            fingerprint: fp,
        });
    }

    let _permit = MediaScheduler::global()
        .acquire_cancellable(ResourceSlot::Ffmpeg, cancel)
        .await
        .ok_or_else(|| "代理视频生成已取消".to_string())?;

    let tmp_path = cache_dir.join(format!("{fp}_proxy.tmp.mp4"));
    let scale_filter = format!("scale=-2:'min({},ih)'", config.max_height);
    let gop_str = config.gop_size.to_string();
    let crf_str = config.crf.to_string();

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-i",
        &source_path.to_string_lossy(),
        "-vf",
        &scale_filter,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        &crf_str,
        "-g",
        &gop_str,
        "-keyint_min",
        &gop_str,
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        &tmp_path.to_string_lossy(),
    ]);

    let run_res = cancel
        .run_command(&mut cmd)
        .await
        .map_err(|e| format!("FFmpeg 代理转码启动失败: {e}"))?;

    let Some(output) = run_res else {
        let _ = std::fs::remove_file(&tmp_path);
        return Err("代理视频生成已被取消".into());
    };

    if !output.status.success() || !tmp_path.exists() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "FFmpeg 代理转码失败: {}",
            String::from_utf8_lossy(&output.stderr)
                .lines()
                .last()
                .unwrap_or("unknown")
        ));
    }

    std::fs::rename(&tmp_path, &proxy_path).map_err(|e| format!("代理文件落盘失败: {e}"))?;
    let _ = evict_cache_lru(cache_dir, config.max_cache_bytes);

    Ok(ProxyArtifact {
        proxy_path,
        cache_hit: false,
        fingerprint: fp,
    })
}

/// 将 PCM s16le 字节流降采样为 `buckets` 个归一化振幅峰值（0.0..=1.0）
pub fn downsample_pcm_s16le_peaks(pcm_bytes: &[u8], buckets: usize) -> Vec<f32> {
    let target_buckets = buckets.max(1);
    let sample_count = pcm_bytes.len() / 2;
    if sample_count == 0 {
        return vec![0.0; target_buckets];
    }

    let mut peaks = Vec::with_capacity(target_buckets);
    for b in 0..target_buckets {
        let start = b * sample_count / target_buckets;
        let end = ((b + 1) * sample_count / target_buckets)
            .max(start + 1)
            .min(sample_count);
        let mut max_amp: f32 = 0.0;
        for i in start..end {
            let lo = pcm_bytes[i * 2];
            let hi = pcm_bytes[i * 2 + 1];
            let sample = i16::from_le_bytes([lo, hi]);
            let norm = (sample as f32 / 32768.0).abs().min(1.0);
            if norm > max_amp {
                max_amp = norm;
            }
        }
        peaks.push((max_amp * 1000.0).round() / 1000.0);
    }
    peaks
}

/// 提取并缓存音频波形峰值 `.peaks.json`
pub async fn extract_audio_peaks(
    source_path: &Path,
    cache_dir: &Path,
    buckets: usize,
    cancel: &CancelToken,
) -> Result<WaveformPeaks, String> {
    if !source_path.exists() {
        return Err(format!("音频/视频文件不存在: {:?}", source_path));
    }
    let _ = std::fs::create_dir_all(cache_dir);
    let fp = compute_fast_fingerprint(source_path)?;
    let peaks_path = cache_dir.join(format!("{fp}_{buckets}.peaks.json"));

    if let Ok(raw) = std::fs::read_to_string(&peaks_path) {
        if let Ok(cached) = serde_json::from_str::<WaveformPeaks>(&raw) {
            return Ok(cached);
        }
    }

    let _permit = MediaScheduler::global()
        .acquire_cancellable(ResourceSlot::Ffmpeg, cancel)
        .await
        .ok_or_else(|| "波形峰值提取已取消".to_string())?;

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-i",
        &source_path.to_string_lossy(),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        "pipe:1",
    ]);

    let output = cancel
        .run_command(&mut cmd)
        .await
        .map_err(|e| format!("FFmpeg 波形提取启动失败: {e}"))?
        .ok_or_else(|| "波形提取已被取消".to_string())?;

    let peaks = downsample_pcm_s16le_peaks(&output.stdout, buckets);
    let artifact = WaveformPeaks {
        fingerprint: fp,
        buckets: peaks.len(),
        peaks,
    };

    if let Ok(json) = serde_json::to_string(&artifact) {
        let _ = std::fs::write(&peaks_path, json);
    }

    Ok(artifact)
}

/// LRU 磁盘缓存淘汰：按修改时间升序清理最久未使用的缓存文件，直到总占用 <= `max_bytes`
pub fn evict_cache_lru(cache_dir: &Path, max_bytes: u64) -> Result<usize, String> {
    if !cache_dir.exists() {
        return Ok(0);
    }
    let mut entries: Vec<(PathBuf, u64, std::time::SystemTime)> = Vec::new();
    let mut total_bytes: u64 = 0;

    let read_dir = std::fs::read_dir(cache_dir).map_err(|e| format!("扫描缓存目录失败: {e}"))?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Ok(meta) = entry.metadata() {
                let sz = meta.len();
                let mtime = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                total_bytes = total_bytes.saturating_add(sz);
                entries.push((path, sz, mtime));
            }
        }
    }

    if total_bytes <= max_bytes {
        return Ok(0);
    }

    // 最旧的排在前面优先淘汰
    entries.sort_by_key(|e| e.2);

    let mut removed = 0usize;
    for (path, sz, _) in entries {
        if total_bytes <= max_bytes {
            break;
        }
        if std::fs::remove_file(&path).is_ok() {
            total_bytes = total_bytes.saturating_sub(sz);
            removed += 1;
        }
    }

    if removed > 0 {
        tracing::info!("Proxy/Peaks LRU 缓存回收完成，清理了 {} 个旧文件", removed);
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downsample_pcm_s16le_peaks() {
        // 构造 4 个采样点：0, 16384 (0.5), -32768 (1.0), 8192 (0.25)
        let samples: [i16; 4] = [0, 16384, -32768, 8192];
        let mut bytes = Vec::new();
        for s in samples {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        let peaks = downsample_pcm_s16le_peaks(&bytes, 2);
        assert_eq!(peaks.len(), 2);
        assert!((peaks[0] - 0.5).abs() < 0.01);
        assert!((peaks[1] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_evict_cache_lru_respects_budget() {
        let dir = std::env::temp_dir().join(format!("dramaxis_lru_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        std::fs::write(dir.join("a.mp4"), vec![1u8; 100]).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(dir.join("b.mp4"), vec![2u8; 100]).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(dir.join("c.mp4"), vec![3u8; 100]).unwrap();

        // 上限 200 字节，应淘汰最老的 a.mp4
        let removed = evict_cache_lru(&dir, 200).expect("evict");
        assert_eq!(removed, 1);
        assert!(!dir.join("a.mp4").exists());
        assert!(dir.join("b.mp4").exists());
        assert!(dir.join("c.mp4").exists());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
