# 实时事件监听矩阵 (Event Matrix)

在复杂长任务执行过程中（如音视频硬件压制、多智能体状态图推演、在线差分下载），Dramaxis 的 Rust 后端通过 Tauri Event 通道向前端 Webview 广播低延迟、强类型的实时流式事件。

---

## 1. 核心事件通道矩阵

| 事件通道 (Channel) | 载荷类型 (Payload) | 触发时机 | 前端响应与建议 |
| :--- | :--- | :--- | :--- |
| **`agent://event`** | `AgentEventPayload` | 智能体步骤开始/完成、DAG 拓扑推进、留存打分完成、HITL 断点触发与反思回退 | 驱动 `ProductionStudio` 状态机、机架指示灯与断点决策弹窗 |
| **`export://progress`** | `f64` (0.0 ~ 1.0) | FFmpeg 硬件加速压制实时渲染百分比与帧计数 | 更新导出模态框圆形进度环 |
| **`export://fission_progress`** | `{ current: number, total: number, percent: number }` | 多版本母带批量渲染任务队列推进 | 刷新母带批量导出进度条 |
| **`updater://event`** | `UpdateEventPayload` | 发现新版本、分片下载字节推进、SHA-256 校验完毕 | 更新 `useUpdateStore`，平滑刷新实时下载速率与剩余时间 |
| **`pipeline://step`** | `PipelineStepEvent` | 7 步底层基础流水线单步切换与完成 | 更新全屏合成进度指示器 |

---

## 2. `AgentEventPayload` 变体定义

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum AgentEventPayload {
    /// 步骤启动
    StepStarted { step: usize, role: AgentRole, name: String },
    /// 步骤圆满完成
    StepCompleted { step: usize, role: AgentRole, summary: String },
    /// 质量门禁完成 4-Gate 综合测评
    QualityGateEvaluated(QualityReport),
    /// 触发人机协同断点 (HITL) 挂起等待决策
    BreakpointRequired(BreakpointRequest),
    /// 断点已被创作者指令响应恢复
    BreakpointResolved { action: String },
    /// DAG 全图调度进度与节点状态集
    DagProgress { snapshot: DagSnapshot },
    /// 评分未达标触发局部反思回路重新生成
    CritiqueLoopTriggered { current_round: u32, max_rounds: u32, reason: String },
    /// 全流程闭环完成
    WorkflowCompleted { total_duration_ms: u64, blackboard: Blackboard },
    /// 异常中断
    Error { step: usize, role: AgentRole, error: String },
}
```

---

## 3. 前端监听与清理范例 (`useTauriEvent`)

前端通过 `@dramaxis/ipc` 提供的门面或统一的 `useTauriEvent` Hook 进行安全监听，并在组件卸载时自动注销句柄，防止内存泄露：

```typescript
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AgentEventPayload } from "@dramaxis/ipc";
import { useAgentStore } from "@dramaxis/core";

export function useAgentEventListener() {
  const handleEvent = useAgentStore((s) => s.handleAgentEvent);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    listen<AgentEventPayload>("agent://event", (event) => {
      handleEvent(event.payload);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [handleEvent]);
}
```
