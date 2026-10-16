use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentRole {
    Director,
    VisualCritic,
    Screenwriter,
    VoiceArtist,
    SoundEngineer,
    QualityReviewer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Idle,
    Thinking,
    Acting,
    AwaitingApproval,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: String,
    pub sender: AgentRole,
    pub receiver: Option<AgentRole>,
    pub thought: Option<String>,
    pub action: Option<String>,
    pub observation: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakpointRequest {
    pub agent: AgentRole,
    pub step_title: String,
    pub content: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityReport {
    pub hook_score: f32,
    pub sync_tolerance_ms: f32,
    pub pacing_score: f32,
    pub compliance_passed: bool,
    pub overall_score: f32,
    pub suggestions: Vec<String>,
}

/// 实时事件总线载荷 (Tauri Event: `agent://event`)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum AgentEventPayload {
    StepStarted {
        step_idx: usize,
        role: AgentRole,
        name: String,
    },
    ThoughtStream {
        role: AgentRole,
        content: String,
    },
    ActionExecuted {
        role: AgentRole,
        action: String,
        observation: String,
    },
    BreakpointRequired(BreakpointRequest),
    StepCompleted {
        step_idx: usize,
        role: AgentRole,
        summary: String,
    },
    QualityGateEvaluated(QualityReport),
    WorkflowCompleted {
        total_steps: usize,
        duration_ms: u64,
    },
    Error {
        role: Option<AgentRole>,
        message: String,
    },
}
