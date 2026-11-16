//! FFmpeg 二进制发现与进程执行器 (FFmpeg Runner & Binary Discovery)

use crate::probe::HardwareAccelerationKind;
use crate::scene::extract_time_line;
use dramaxis_core::error::{DramaxisError, DramaxisResult};
use std::path::{Path, PathBuf};
use std::process::Stdio;

/// FFmpeg 进度回调: (已处理秒数, 百分比 0-100 if known)
pub type ProgressFn = dyn Fn(f64, Option<u8>) + Send + Sync;

#[derive(Debug, Clone)]
pub struct Ffmpeg {
    pub ffmpeg_bin: PathBuf,
    pub ffprobe_bin: PathBuf,
}

impl Ffmpeg {
    /// 从 PATH 发现 ffmpeg + ffprobe。缺失返回 `Ffmpeg` 错误。
    pub fn discover() -> DramaxisResult<Self> {
        let ffmpeg = which("ffmpeg")
            .ok_or_else(|| DramaxisError::Ffmpeg("ffmpeg 不在 PATH 中 (请先安装 ffmpeg)".into()))?;
        let ffprobe = which("ffprobe")
            .ok_or_else(|| DramaxisError::Ffmpeg("ffprobe 不在 PATH 中 (请先安装 ffmpeg)".into()))?;
        Ok(Self {
            ffmpeg_bin: ffmpeg,
            ffprobe_bin: ffprobe,
        })
    }

    /// 是否可用 (不抛错版本)
    pub fn is_available() -> bool {
        which("ffmpeg").is_some() && which("ffprobe").is_some()
    }

    /// 自定义路径构造 (测试 / sidecar 场景)
    pub fn with_bins(ffmpeg: PathBuf, ffprobe: PathBuf) -> Self {
        Self {
            ffmpeg_bin: ffmpeg,
            ffprobe_bin: ffprobe,
        }
    }

    /// 探测当前机器支持的 GPU 硬件编解码加速器
    pub async fn probe_hardware_acceleration(&self) -> Vec<HardwareAccelerationKind> {
        let mut supported = Vec::new();
        if let Ok(output) = self
            .run_raw(&self.ffmpeg_bin, &["-encoders"], None, None)
            .await
        {
            let lower = output.to_lowercase();
            if lower.contains("h264_videotoolbox") || lower.contains("hevc_videotoolbox") {
                supported.push(HardwareAccelerationKind::VideoToolbox);
            }
            if lower.contains("h264_nvenc") || lower.contains("hevc_nvenc") {
                supported.push(HardwareAccelerationKind::Nvenc);
            }
            if lower.contains("h264_qsv") || lower.contains("hevc_qsv") {
                supported.push(HardwareAccelerationKind::Qsv);
            }
            if lower.contains("h264_amf") || lower.contains("hevc_amf") {
                supported.push(HardwareAccelerationKind::Amf);
            }
            if lower.contains("h264_vaapi") || lower.contains("hevc_vaapi") {
                supported.push(HardwareAccelerationKind::Vaapi);
            }
        }
        if supported.is_empty() {
            supported.push(HardwareAccelerationKind::None);
        }
        supported
    }

    /// 竖屏画布: scale 适配 + pad 居中 (默认 1080x1920)
    pub async fn scale_pad_vertical(
        &self,
        input: &Path,
        output: &Path,
        width: u32,
        height: u32,
        fps: u32,
        bitrate: &str,
    ) -> DramaxisResult<()> {
        let filter = format!(
            "scale={width}:{height}:force_original_aspect_ratio=decrease,\
             pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
        );
        self.run_encode(
            &[
                "-i",
                &input.to_string_lossy(),
                "-vf",
                &filter,
                "-r",
                &fps.to_string(),
                "-c:v",
                "libx264",
                "-b:v",
                bitrate,
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                &output.to_string_lossy(),
            ],
            None,
        )
        .await
    }

    /// SRT 字幕烧录
    pub async fn burn_captions(&self, input: &Path, srt: &Path, output: &Path) -> DramaxisResult<()> {
        let srt_escaped = srt
            .to_string_lossy()
            .replace(':', "\\:")
            .replace('\'', "\\'");
        let filter = format!("subtitles='{srt_escaped}'");
        self.run_encode(
            &[
                "-i",
                &input.to_string_lossy(),
                "-vf",
                &filter,
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "copy",
                &output.to_string_lossy(),
            ],
            None,
        )
        .await
    }

    /// 配音混流: 视频 + 旁白音频 (无声视频安全兼容量,原声降低到 15%)
    pub async fn mix_narration(
        &self,
        video: &Path,
        narration: &Path,
        output: &Path,
    ) -> DramaxisResult<()> {
        let has_audio = self
            .probe(video)
            .await
            .map(|p| p.audio_codec.is_some())
            .unwrap_or(true);

        if has_audio {
            self.run_encode(
                &[
                    "-i",
                    &video.to_string_lossy(),
                    "-i",
                    &narration.to_string_lossy(),
                    "-filter_complex",
                    "[0:a]volume=0.15[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
                    "-map",
                    "0:v",
                    "-map",
                    "[aout]",
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-shortest",
                    &output.to_string_lossy(),
                ],
                None,
            )
            .await
        } else {
            self.run_encode(
                &[
                    "-i",
                    &video.to_string_lossy(),
                    "-i",
                    &narration.to_string_lossy(),
                    "-map",
                    "0:v",
                    "-map",
                    "1:a",
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-shortest",
                    &output.to_string_lossy(),
                ],
                None,
            )
            .await
        }
    }

    /// 多段拼接 (concat demuxer,先写 list 文件)
    pub async fn concat(&self, inputs: &[PathBuf], output: &Path) -> DramaxisResult<()> {
        if inputs.is_empty() {
            return Err(DramaxisError::Ffmpeg("concat: 输入列表为空".into()));
        }
        let list_path = output.with_extension("concat.txt");
        let list_content = inputs
            .iter()
            .map(|p| format!("file '{}'", p.to_string_lossy().replace('\'', "'\\''")))
            .collect::<Vec<_>>()
            .join("\n");
        tokio::fs::write(&list_path, list_content).await?;

        let result = self
            .run_encode(
                &[
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    &list_path.to_string_lossy(),
                    "-c",
                    "copy",
                    &output.to_string_lossy(),
                ],
                None,
            )
            .await;
        let _ = tokio::fs::remove_file(&list_path).await;
        result
    }

    /// 执行编码类命令: 成功要求 exit 0,失败带 stderr tail。
    pub async fn run_encode(
        &self,
        args: &[&str],
        on_progress: Option<&ProgressFn>,
    ) -> DramaxisResult<()> {
        let _ = self.run_stderr(args, on_progress).await?;
        Ok(())
    }

    /// 执行 ffmpeg 并返回 stderr (进度解析内嵌)。
    pub async fn run_stderr(
        &self,
        args: &[&str],
        on_progress: Option<&ProgressFn>,
    ) -> Result<String, DramaxisError> {
        let mut full: Vec<&str> = vec!["-hide_banner"];
        if on_progress.is_none() {
            full.push("-nostats");
        }
        full.extend_from_slice(args);
        Ok(self
            .run_raw(&self.ffmpeg_bin, &full, on_progress, None)
            .await?)
    }

    /// 底层执行: 捕获 stdout/stderr,解析 time= 进度。exit != 0 → Err(stderr tail)。
    pub async fn run_raw(
        &self,
        bin: &Path,
        args: &[&str],
        on_progress: Option<&ProgressFn>,
        _total_seconds: Option<f64>,
    ) -> Result<String, RawExecError> {
        use tokio::io::AsyncReadExt;

        let mut cmd = tokio::process::Command::new(bin);
        cmd.args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| RawExecError {
            stderr_tail: format!("spawn failed: {e}"),
        })?;

        let stdout_take = child.stdout.take();
        let stderr_take = child.stderr.take();
        let on_progress_ptr: Option<&ProgressFn> = on_progress;

        let stderr_task = async move {
            let mut buf = String::new();
            if let Some(mut err) = stderr_take {
                let mut chunk = [0u8; 4096];
                loop {
                    let n = err.read(&mut chunk).await.map_err(|e| RawExecError {
                        stderr_tail: format!("read stderr: {e}"),
                    })?;
                    if n == 0 {
                        break;
                    }
                    let text = String::from_utf8_lossy(&chunk[..n]);
                    buf.push_str(&text);
                    if let Some(cb) = on_progress_ptr {
                        for line in text.split('\r') {
                            if let Some(sec) = extract_time_line(line) {
                                cb(sec, None);
                            }
                        }
                    }
                    if buf.len() > 8192 {
                        let start = buf.len() - 4096;
                        buf = buf.split_off(start);
                    }
                }
            }
            Ok::<String, RawExecError>(buf)
        };

        let stdout_task = async move {
            let mut buf = Vec::new();
            if let Some(mut out) = stdout_take {
                out.read_to_end(&mut buf).await.map_err(|e| RawExecError {
                    stderr_tail: format!("read stdout: {e}"),
                })?;
            }
            Ok::<Vec<u8>, RawExecError>(buf)
        };

        let (stderr_res, stdout_res) = tokio::join!(stderr_task, stdout_task);
        let stderr_buf = stderr_res?;
        let stdout_buf = stdout_res?;

        let status = child.wait().await.map_err(|e| RawExecError {
            stderr_tail: format!("wait: {e}"),
        })?;

        if !status.success() {
            let tail = tail_lines(&stderr_buf, 8);
            tracing::warn!(
                bin = %bin.display(),
                code = ?status.code(),
                stderr = %tail,
                "FFmpeg process exited with error status"
            );
            return Err(RawExecError { stderr_tail: tail });
        }
        Ok(String::from_utf8_lossy(&stdout_buf).into_owned())
    }
}

#[derive(Debug)]
pub struct RawExecError {
    pub stderr_tail: String,
}

impl From<RawExecError> for DramaxisError {
    fn from(e: RawExecError) -> Self {
        DramaxisError::Ffmpeg(e.stderr_tail)
    }
}

fn tail_lines(s: &str, n: usize) -> String {
    let lines: Vec<&str> = s.lines().filter(|l| !l.trim().is_empty()).collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

/// 增强型 which: PATH 探测 + 系统常见包管理目录与 Sidecar 兜底探测
fn which(bin: &str) -> Option<PathBuf> {
    let bin_names: Vec<String> = if cfg!(target_os = "windows") && !bin.ends_with(".exe") {
        vec![format!("{bin}.exe"), bin.to_string()]
    } else {
        vec![bin.to_string()]
    };

    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            for b in &bin_names {
                let candidate = dir.join(b);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            for b in &bin_names {
                let candidate = parent.join(b);
                if candidate.is_file() {
                    return Some(candidate);
                }
                let mac_res = parent.join("../Resources/bin").join(b);
                if mac_res.is_file() {
                    return Some(mac_res);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let common_mac_paths = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/opt/local/bin",
        ];
        for dir_str in common_mac_paths {
            for b in &bin_names {
                let candidate = PathBuf::from(dir_str).join(b);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let base_dir = PathBuf::from(local_app_data).join("ffmpeg").join("bin");
            for b in &bin_names {
                let candidate = base_dir.join(b);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
        let default_c_bin = PathBuf::from(r"C:\ffmpeg\bin");
        for b in &bin_names {
            let candidate = default_c_bin.join(b);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let common_linux_paths = ["/usr/bin", "/usr/local/bin", "/bin", "/snap/bin"];
        for dir_str in common_linux_paths {
            for b in &bin_names {
                let candidate = PathBuf::from(dir_str).join(b);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    None
}
