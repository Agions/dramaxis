//! Tauri 命令分组 · dramaxis-agent 多智能体协同服务 (DAG 状态机与反思闭环)

use dramaxis_agent::{
    AgentContext, AgentEventPayload, AgentOrchestrator, Blackboard, BreakpointRequest,
    DagOrchestrator, DagSnapshot,
};
use dramaxis_core::domain::Project;
use dramaxis_core::error::SplicrError;
use dramaxis_core::services::{ConfigService, ConfigSnapshot};
use dramaxis_core::AppContext;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;

// 内部状态管理器 (同时支持传统分步编排与 DAG 状态机)
pub struct AgentServiceState {
    pub orchestrator: Arc<RwLock<Option<AgentOrchestrator>>>,
    pub dag: Arc<RwLock<Option<DagOrchestrator>>>,
}

impl Default for AgentServiceState {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentServiceState {
    pub fn new() -> Self {
        Self {
            orchestrator: Arc::new(RwLock::new(None)),
            dag: Arc::new(RwLock::new(None)),
        }
    }
}

/// 启动多智能体团队协同 (初始化 DAG 编排引擎与上下文)
#[tauri::command]
pub async fn agent_start(
    app_handle: tauri::AppHandle,
    project: Project,
    auto_mode: bool,
    app_ctx: State<'_, AppContext>,
    state: State<'_, AgentServiceState>,
) -> Result<AgentContext, SplicrError> {
    let mut ctx = AgentContext::new(project, auto_mode);

    // 自动装配当前设置中的 LLM 与 TTS 凭证至 Agent 上下文内存
    if let Ok(cfg_svc) = app_ctx.service::<ConfigService>().await {
        let snap: ConfigSnapshot = cfg_svc.snapshot().await;
        if let Some(key) = snap.llm_api_key {
            ctx.memory.insert("llm_api_key".to_string(), key);
        }
        if let Some(model) = snap.llm_model {
            ctx.memory.insert("llm_model".to_string(), model);
        }
        if let Some(base_url) = snap.llm_base_url {
            ctx.memory.insert("llm_base_url".to_string(), base_url);
        }
        if let Some(matrix) = snap.agent_model_matrix {
            if let Ok(matrix_json) = serde_json::to_string(&matrix) {
                ctx.memory.insert("agent_model_matrix_json".to_string(), matrix_json);
            }
        }
        ctx.memory
            .insert("llm_provider".to_string(), snap.llm_provider.to_string());
    }

    let handle_clone = app_handle.clone();
    let emitter = Arc::new(move |payload: AgentEventPayload| {
        let _ = handle_clone.emit("agent://event", payload);
    });

    let orch = AgentOrchestrator::new(ctx.clone()).with_emitter(emitter.clone());
    let dag = DagOrchestrator::new(ctx.clone()).with_emitter(emitter);

    {
        let mut orch_lock = state.orchestrator.write().await;
        *orch_lock = Some(orch);
    }
    {
        let mut dag_lock = state.dag.write().await;
        *dag_lock = Some(dag);
    }

    Ok(ctx)
}

/// 执行完整的 DAG 状态机编排推演 (支持并行分支、反思回路与 HITL 断点)
#[tauri::command]
pub async fn agent_run_dag(
    state: State<'_, AgentServiceState>,
) -> Result<Option<BreakpointRequest>, SplicrError> {
    let mut lock = state.dag.write().await;
    if let Some(dag) = lock.as_mut() {
        dag.run_dag()
            .await
            .map_err(|e| SplicrError::Pipeline(e.to_string()))
    } else {
        Err(SplicrError::Pipeline(
            "DAG 智能体调度器尚未初始化".to_string(),
        ))
    }
}

/// 恢复人机协同断点 (HITL) 并传入用户选择动作与可选自然语言靶向指令
#[tauri::command]
pub async fn agent_resume_breakpoint(
    action: String,
    feedback: Option<String>,
    state: State<'_, AgentServiceState>,
) -> Result<Option<BreakpointRequest>, SplicrError> {
    let mut lock = state.dag.write().await;
    if let Some(dag) = lock.as_mut() {
        dag.resume_breakpoint(&action, feedback)
            .await
            .map_err(|e| SplicrError::Pipeline(e.to_string()))
    } else {
        Err(SplicrError::Pipeline(
            "DAG 智能体调度器尚未初始化".to_string(),
        ))
    }
}

/// 获取当前 DAG 调度快照 (所有节点状态、反思轮次、耗时)
#[tauri::command]
pub async fn agent_get_dag_snapshot(
    state: State<'_, AgentServiceState>,
) -> Result<Option<DagSnapshot>, SplicrError> {
    let lock = state.dag.read().await;
    if let Some(dag) = lock.as_ref() {
        let snap = dag.snapshot().await;
        Ok(Some(snap))
    } else {
        Ok(None)
    }
}

/// 执行单步智能体调度 (兼容旧版线性调用)
#[tauri::command]
pub async fn agent_step(
    step_idx: usize,
    state: State<'_, AgentServiceState>,
) -> Result<Option<BreakpointRequest>, SplicrError> {
    let lock = state.orchestrator.read().await;
    if let Some(orch) = lock.as_ref() {
        orch.run_step(step_idx)
            .await
            .map_err(|e| SplicrError::Pipeline(e.to_string()))
    } else {
        Err(SplicrError::Pipeline("智能体调度器尚未初始化".to_string()))
    }
}

/// 获取当前多智能体上下文日志与思考流 (优先读取实时 DAG 引擎上下文)
#[tauri::command]
pub async fn agent_get_context(
    state: State<'_, AgentServiceState>,
) -> Result<Option<AgentContext>, SplicrError> {
    let dag_lock = state.dag.read().await;
    if let Some(dag) = dag_lock.as_ref() {
        let ctx = dag.context.read().await;
        return Ok(Some(ctx.clone()));
    }
    let lock = state.orchestrator.read().await;
    if let Some(orch) = lock.as_ref() {
        let ctx_lock = orch.context().await;
        let ctx = ctx_lock.read().await;
        Ok(Some(ctx.clone()))
    } else {
        Ok(None)
    }
}

/// 获取强类型版本化黑板总线快照
#[tauri::command]
pub async fn agent_get_blackboard(
    state: State<'_, AgentServiceState>,
) -> Result<Option<Blackboard>, SplicrError> {
    let dag_lock = state.dag.read().await;
    if let Some(dag) = dag_lock.as_ref() {
        let ctx = dag.context.read().await;
        return Ok(Some(ctx.blackboard.clone()));
    }
    let orch_lock = state.orchestrator.read().await;
    if let Some(orch) = orch_lock.as_ref() {
        let ctx_lock = orch.context().await;
        let ctx = ctx_lock.read().await;
        return Ok(Some(ctx.blackboard.clone()));
    }
    Ok(None)
}

/// 回滚剧本文案至指定版本
#[tauri::command]
pub async fn agent_rollback_script(
    version: u32,
    state: State<'_, AgentServiceState>,
) -> Result<bool, SplicrError> {
    let dag_lock = state.dag.read().await;
    if let Some(dag) = dag_lock.as_ref() {
        let mut ctx = dag.context.write().await;
        let success = ctx.blackboard.rollback_script_to_version(version);
        if success {
            let active_text = ctx.blackboard.active_script().map(|s| s.text.clone());
            if let Some(text) = active_text {
                ctx.memory.insert("script_text".into(), text);
            }
        }
        return Ok(success);
    }
    Ok(false)
}
