# dramaxis-agent · 6-Agent 状态图与版本化黑板协同中枢

`dramaxis-agent` 负责总控导演 (`Director`)、视觉分析师 (`VisualCritic`)、金牌编剧 (`Screenwriter`)、声乐调音师 (`VoiceArtist`)、混音剪辑师 (`SoundEngineer`) 与质量守门员 (`QualityReviewer`) 6 大智能体的声明式状态图 (`StateGraph`) 编排、版本化黑板 (`Blackboard`) 通信、自反思闭环 (`Critique Loop`) 与人机协同断点 (`HITL`) 管理。

---

## 1. 核心职责与架构特性

- **声明式动态状态图 (`StateGraph`)**：支持静态依赖边、并发汇聚同步屏障 (`SyncBarrier` + `StateReducer`)、动态条件路由边 (`ConditionalEdge`) 与局部子图拓扑失效重算 (`invalidate_subgraph`)。
- **强类型版本化黑板总线 (`Blackboard`)**：跨智能体传递 `VisualBriefArtifact`、`AudioBriefArtifact`、`Vec<ScriptArtifact>`、`VoiceArtifact`、`TimelineArtifact` 与 `QualityReportArtifact`，支持剧本多版本演进追溯与一键回滚。
- **人机协同断点 (`HITL Checkpoint`)**：支持在关键交付节点挂起工作流，接收创作者批准定稿或自然语言靶向改修指令。

---

## 2. 关键结构体定义 (`types.rs` / `blackboard.rs` / `dag.rs`)

```rust
pub struct AgentContext {
    pub session_id: String,
    pub project: Project,
    pub current_role: AgentRole,
    pub status: AgentStatus,
    pub messages: Vec<AgentMessage>,
    pub blackboard: Blackboard,
    pub auto_mode: bool,
}

pub struct DagSnapshot {
    pub session_id: String,
    pub total_nodes: usize,
    pub completed_nodes: usize,
    pub nodes: Vec<DagNodeInfo>,
    pub in_critique_loop: bool,
    pub critique_count: u32,
}

pub struct BreakpointRequest {
    pub agent: AgentRole,
    pub step_title: String,
    pub content: String,
    pub options: Vec<String>,
}
```
