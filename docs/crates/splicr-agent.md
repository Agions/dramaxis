# splicr-agent · 6-Agent 多智能体协同中枢

`splicr-agent` 负责导演、编剧、配音、剪辑、调色、运营等 6 大智能体的协同调度、状态机推演与断点交互管理。

---

## 1. 核心职责与拓扑

- **智能体生命周期**：管理从 `Idle` ➔ `Running` ➔ `Paused` ➔ `Completed` 的完整生命周期。
- **上下文消息总线**：在智能体之间安全传递 `AgentMessage`，包含角色标记、步骤序号与有效载荷。
- **断点控制 (Breakpoint)**：支持创作者在任意智能体产出后暂停流水线并手动介入微调。

---

## 2. 关键结构体定义 (`types.rs` & `context.rs`)

```rust
pub struct AgentContext {
    pub project_id: String,
    pub active_role: AgentRole,
    pub history: Vec<AgentMessage>,
    pub current_step: usize,
    pub total_steps: usize,
}

pub struct BreakpointRequest {
    pub step_index: usize,
    pub reason: String,
    pub proposed_payload: serde_json::Value,
}
```
