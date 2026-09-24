# 实时事件监听矩阵 (Event Matrix)

在复杂长任务执行过程中（如视频转码、大模型推演、更新下载），Rust 后端通过 Tauri Event 机制向前端广播高频状态与实时进度。

---

## 1. 核心事件列表

| 事件通道 (Channel) | 载荷类型 (Payload)        | 触发时机                             | 前端处理建议                          |
| :----------------- | :------------------------ | :----------------------------------- | :------------------------------------ |
| `updater:event`    | `UpdateEvent` 或 `string` | 下载进度更新、状态阶段切换、校验就绪 | 更新 `useUpdateStore`，刷新网速进度条 |
| `agent:progress`   | `AgentEventPayload`       | 智能体步骤切换、流式生成 Token       | 更新 `AgentStudioRack` 步骤指示器     |
| `pipeline:step`    | `StepDef`                 | 5 轨合成各阶段（VAD/对齐/避让）完成  | 更新全屏进度浮层                      |
| `pipeline:error`   | `{ message: string }`     | 依赖缺失或转码异常                   | 弹出 Sonner 警告 Toast 并暂停流水线   |

---

## 2. 前端监听范例

```typescript
import { listen } from "@tauri-apps/api/event";
import { useUpdateStore } from "@splicr/core";

// 监听更新器广播
const unlisten = await listen("updater:event", (event) => {
  console.log("收到更新器事件:", event.payload);
});
```
