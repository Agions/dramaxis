//! dramaxis-core::scheduler · 全局资源并发背压与子进程级即时取消原语
//!
//! ## 核心能力
//! 1. [`CancelToken`]：基于 `AtomicBool + tokio::sync::Notify` 的轻量级取消令牌，
//!    支持将取消信号下沉至运行中的 `tokio::process::Command`（FFmpeg / Whisper 等子进程），
//!    取消后毫秒级 `kill` 子进程，避免等待数分钟的“步边界取消”卡死。
//! 2. [`MediaScheduler`]：按算子类型（FFmpeg / ASR / LLM API / TTS API）隔离并发槽位，
//!    防止批量任务同时拉起多个 FFmpeg 或打爆 API 限流。

use serde::{Deserialize, Serialize};
use std::io;
use std::process::Output;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use tokio::process::Command;
use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore};

/// 跨异步任务与子进程共享的取消令牌
#[derive(Debug, Clone, Default)]
pub struct CancelToken {
    cancelled: Arc<AtomicBool>,
    notify: Arc<Notify>,
}

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    /// 触发取消并唤醒所有等待中的任务/子进程
    pub fn cancel(&self) {
        if !self.cancelled.swap(true, Ordering::SeqCst) {
            self.notify.notify_waiters();
        }
    }

    /// 查询当前是否已取消
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// 异步等待直到取消事件发生（若已取消则立即返回）
    pub async fn cancelled(&self) {
        if self.is_cancelled() {
            return;
        }
        let notified = self.notify.notified();
        // 二次检查避免竞态丢唤醒
        if self.is_cancelled() {
            return;
        }
        notified.await;
    }

    /// 运行外部子进程并支持即时取消：
    /// - 正常退出返回 `Ok(Some(Output))`
    /// - 取消触发后立即强杀子进程并返回 `Ok(None)`
    pub async fn run_command(&self, cmd: &mut Command) -> io::Result<Option<Output>> {
        use tokio::io::AsyncReadExt;

        if self.is_cancelled() {
            return Ok(None);
        }

        cmd.kill_on_drop(true);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn()?;
        let mut child_stdout = child.stdout.take();
        let mut child_stderr = child.stderr.take();

        let stdout_task = tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(ref mut out) = child_stdout {
                let _ = out.read_to_end(&mut buf).await;
            }
            buf
        });
        let stderr_task = tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(ref mut err) = child_stderr {
                let _ = err.read_to_end(&mut buf).await;
            }
            buf
        });

        tokio::select! {
            biased;
            _ = self.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                stdout_task.abort();
                stderr_task.abort();
                Ok(None)
            }
            status_res = child.wait() => {
                let status = status_res?;
                let stdout = stdout_task.await.unwrap_or_default();
                let stderr = stderr_task.await.unwrap_or_default();
                Ok(Some(Output { status, stdout, stderr }))
            }
        }
    }
}

/// 算子并发资源槽位分类
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceSlot {
    /// FFmpeg 编解码 / 抽帧 / 压制槽位（高 CPU/GPU 占用）
    Ffmpeg,
    /// 本地 ASR 模型推理槽位（高显存/内存占用）
    Asr,
    /// 大语言模型 / VLM HTTP API 并发槽位
    LlmApi,
    /// TTS 语音合成并发槽位
    TtsApi,
}

/// 调度器各槽位实时并发水位快照
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerStats {
    pub ffmpeg_available: usize,
    pub asr_available: usize,
    pub llm_api_available: usize,
    pub tts_api_available: usize,
}

/// 全局算子并发背压调度器
#[derive(Debug, Clone)]
pub struct MediaScheduler {
    ffmpeg: Arc<Semaphore>,
    asr: Arc<Semaphore>,
    llm_api: Arc<Semaphore>,
    tts_api: Arc<Semaphore>,
}

impl MediaScheduler {
    /// 构造自定义并发上限的调度器
    pub fn with_limits(
        ffmpeg_limit: usize,
        asr_limit: usize,
        llm_api_limit: usize,
        tts_api_limit: usize,
    ) -> Self {
        Self {
            ffmpeg: Arc::new(Semaphore::new(ffmpeg_limit.max(1))),
            asr: Arc::new(Semaphore::new(asr_limit.max(1))),
            llm_api: Arc::new(Semaphore::new(llm_api_limit.max(1))),
            tts_api: Arc::new(Semaphore::new(tts_api_limit.max(1))),
        }
    }

    /// 全局默认单例（FFmpeg=2, ASR=1, LLM=4, TTS=4）
    pub fn global() -> &'static Self {
        static INSTANCE: OnceLock<MediaScheduler> = OnceLock::new();
        INSTANCE.get_or_init(|| Self::with_limits(2, 1, 4, 4))
    }

    /// 申请指定资源槽位的执行许可（支持并发背压）
    pub async fn acquire(&self, slot: ResourceSlot) -> Option<OwnedSemaphorePermit> {
        let sem = match slot {
            ResourceSlot::Ffmpeg => self.ffmpeg.clone(),
            ResourceSlot::Asr => self.asr.clone(),
            ResourceSlot::LlmApi => self.llm_api.clone(),
            ResourceSlot::TtsApi => self.tts_api.clone(),
        };
        sem.acquire_owned().await.ok()
    }

    /// 带取消令牌的资源槽位申请：等待许可期间若被取消则立即返回 `None`
    pub async fn acquire_cancellable(
        &self,
        slot: ResourceSlot,
        cancel: &CancelToken,
    ) -> Option<OwnedSemaphorePermit> {
        tokio::select! {
            biased;
            _ = cancel.cancelled() => None,
            permit = self.acquire(slot) => permit,
        }
    }

    /// 获取各槽位当前可用水位
    pub fn stats(&self) -> SchedulerStats {
        SchedulerStats {
            ffmpeg_available: self.ffmpeg.available_permits(),
            asr_available: self.asr.available_permits(),
            llm_api_available: self.llm_api.available_permits(),
            tts_api_available: self.tts_api.available_permits(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[tokio::test]
    async fn test_cancel_token_kills_running_process_fast() {
        let token = CancelToken::new();
        let stopper = token.clone();

        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(80)).await;
            stopper.cancel();
        });

        let start = Instant::now();
        let mut cmd = Command::new("sleep");
        cmd.arg("10");
        let result = token.run_command(&mut cmd).await.expect("spawn sleep");

        assert!(result.is_none(), "取消后应立即返回 None 并终止子进程");
        assert!(
            start.elapsed() < Duration::from_secs(2),
            "取消响应耗时过长: {:?}",
            start.elapsed()
        );
    }

    #[tokio::test]
    async fn test_media_scheduler_backpressure_and_cancel() {
        let sched = MediaScheduler::with_limits(1, 1, 2, 2);
        let p1 = sched.acquire(ResourceSlot::Ffmpeg).await.expect("permit 1");
        assert_eq!(sched.stats().ffmpeg_available, 0);

        // 在许可被占满时，带取消令牌的等待应能立即响应取消
        let token = CancelToken::new();
        let t2 = token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(40)).await;
            t2.cancel();
        });

        let p2 = sched.acquire_cancellable(ResourceSlot::Ffmpeg, &token).await;
        assert!(p2.is_none());

        drop(p1);
        assert_eq!(sched.stats().ffmpeg_available, 1);
    }
}
