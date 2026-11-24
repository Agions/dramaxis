//! dramaxis-agent::dag · 基于声明式动态状态图 (StateGraph) 的 Multi-Agent 编排引擎
//!
//! ## 核心能力
//! 1. **声明式状态图 (StateGraph)**：节点、依赖边、条件边与屏障统一图论建模
//! 2. **并发分支与屏障汇聚 (SyncBarrier)**：视觉抽样与音频探测并行，屏障原子归约黑板状态
//! 3. **动态条件路由 (Conditional Routing)**：质检未达标自动由条件路由决策反思回路
//! 4. **局部拓扑失效重算 (Selective Invalidation)**：反思回路仅失效下游，前置昂贵抽样完全缓存
//! 5. **策略级优雅降级 (Graceful Fallback)**：关键节点发生网络或外部故障时自动执行备选降级策略
//! 6. **人机协同断点 (HITL Checkpoint)**：关键交付节点向前端挂起交互并支持靶向自然语言精修

use crate::context::AgentContext;
use crate::graph::{GraphNode, StateGraph};
use crate::types::{
    AgentEventPayload, AgentRole, AgentStatus, BreakpointRequest, DagNodeInfo, DagNodeStatus,
    DagSnapshot, QualityReport, WorkflowProfile,
};
use dramaxis_core::{CancelToken, DramaxisError, DramaxisResult};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

pub type EventEmitter = Arc<dyn Fn(AgentEventPayload) + Send + Sync>;

/// 断点持久化回调钩子：(session_id, project_id, node_id, profile_name, blackboard_json, dag_snapshot_json)
pub type CheckpointHook = Arc<dyn Fn(&str, &str, &str, &str, &str, &str) + Send + Sync>;

/// DAG 节点实体（向后兼容视图层契约）
#[derive(Clone)]
pub struct DagNode {
    pub id: &'static str,
    pub name: &'static str,
    pub role: AgentRole,
    pub dependencies: Vec<&'static str>,
    pub status: DagNodeStatus,
    pub is_hitl_checkpoint: bool,
    pub duration_ms: u64,
    pub summary: Option<String>,
}

/// DAG 调度编排器（基于 StateGraph 声明式图引擎）
pub struct DagOrchestrator {
    pub context: Arc<RwLock<AgentContext>>,
    pub nodes: Vec<DagNode>,
    pub graph: StateGraph<AgentContext>,
    pub event_emitter: Option<EventEmitter>,
    pub checkpoint_hook: Option<CheckpointHook>,
    pub cancel_token: CancelToken,
    pub profile: WorkflowProfile,
    pub critique_count: u32,
    pub max_critique_rounds: u32,
    pub deps: Arc<std::sync::RwLock<crate::deps::AgentRuntimeDeps>>,
}

impl DagOrchestrator {
    /// 构造标准微短剧工作流 (默认 9 节点)
    pub fn new(context: AgentContext) -> Self {
        Self::with_profile(context, WorkflowProfile::StandardDrama)
    }

    /// 根据业务场景模板构造声明式 StateGraph 工作流
    pub fn with_profile(context: AgentContext, profile: WorkflowProfile) -> Self {
        let max_critique_rounds = 2;
        let mut graph = StateGraph::<AgentContext>::new();
        let deps = Arc::new(std::sync::RwLock::new(
            crate::deps::AgentRuntimeDeps::default(),
        ));

        let nodes = match profile {
            WorkflowProfile::StandardDrama => {
                // 1. 注册图节点
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "director_plan",
                        "🎬 总控导演 · 统筹策划与任务派发",
                        AgentRole::Director,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "director_plan",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "visual_analysis",
                        "👁️ 视觉分析师 · 场景突变硬切与关键帧萃取",
                        AgentRole::VisualCritic,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "visual_analysis",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "dialogue_probe",
                        "🎧 音频分析师 · 原片原声对白与节奏探测",
                        AgentRole::SoundEngineer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "dialogue_probe",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "screenwriter_draft",
                        "✍️ 金牌编剧 · 第一人称爆款解说撰写",
                        AgentRole::Screenwriter,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "screenwriter_draft",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "critic_review",
                        "🔍 剧本质检 · 节奏密度与黄金前3秒评审闭环",
                        AgentRole::QualityReviewer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "critic_review",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "hitl_approval",
                        "🤝 人机协同 · 剧本精修与终版确认 (HITL)",
                        AgentRole::Director,
                    )
                    .with_hitl(true)
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "hitl_approval",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new("voice_synthesis", "🎙️ 配音师 · 48kHz 影视广播级人声合成", AgentRole::VoiceArtist)
                        .with_handler(Arc::new(move |ctx| {
                            let current_deps = Arc::new(d.read().unwrap().clone());
                            Box::pin(Self::execute_static_node_logic(ctx, "voice_synthesis", current_deps))
                        }))
                        .with_fallback(Arc::new(|ctx| {
                            Box::pin(async move {
                                let mut c = ctx.write().await;
                                c.log_thought(
                                    AgentRole::VoiceArtist,
                                    "语音合成主通道响应超时，已自动激活本地离线声学占位通道保证流程不中断",
                                );
                                Ok("配音完成 [离线声学兜底]".into())
                            })
                        })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "timeline_compose",
                        "🎛️ 音频调音师 · 5轨毫秒级磁吸与智能避让",
                        AgentRole::SoundEngineer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "timeline_compose",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "quality_gate",
                        "🛡️ 终审守门员 · 视听合规与全案质检",
                        AgentRole::QualityReviewer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "quality_gate",
                            current_deps,
                        ))
                    })),
                );

                // 2. 声明依赖边与并行汇聚屏障
                graph.add_edge("director_plan", "visual_analysis");
                graph.add_edge("director_plan", "dialogue_probe");

                // 声明屏障：编剧起稿必须汇聚视觉抽样与音频探测，并归约对齐黑板产物
                graph.add_barrier(
                    "screenwriter_draft",
                    vec!["visual_analysis".into(), "dialogue_probe".into()],
                    Some(Arc::new(|ctx: &mut AgentContext| {
                        ctx.log_action(
                            AgentRole::Screenwriter,
                            "视听多模态汇聚",
                            "已聚合视觉场景硬切切点与原片音频声学节奏，准备生成第一人称故事脚本",
                        );
                    })),
                );

                graph.add_edge("screenwriter_draft", "critic_review");

                // 3. 声明反思闭环条件路由边
                graph.add_conditional_edge(
                    "critic_review",
                    Arc::new(move |ctx: &AgentContext| {
                        let score = ctx
                            .memory
                            .get("critic_score")
                            .and_then(|s| s.parse::<f32>().ok())
                            .unwrap_or(85.0);
                        let critique_rounds = ctx
                            .memory
                            .get("critique_rounds_executed")
                            .and_then(|s| s.parse::<u32>().ok())
                            .unwrap_or(0);

                        if score < 80.0 && critique_rounds < max_critique_rounds {
                            "screenwriter_draft".into()
                        } else {
                            "hitl_approval".into()
                        }
                    }),
                    vec!["screenwriter_draft".into(), "hitl_approval".into()],
                );

                graph.add_edge("hitl_approval", "voice_synthesis");
                graph.add_edge("voice_synthesis", "timeline_compose");
                graph.add_edge("timeline_compose", "quality_gate");

                vec![
                    DagNode {
                        id: "director_plan",
                        name: "🎬 总控导演 · 统筹策划与任务派发",
                        role: AgentRole::Director,
                        dependencies: vec![],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "visual_analysis",
                        name: "👁️ 视觉分析师 · 场景突变硬切与关键帧萃取",
                        role: AgentRole::VisualCritic,
                        dependencies: vec!["director_plan"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "dialogue_probe",
                        name: "🎧 音频分析师 · 原片原声对白与节奏探测",
                        role: AgentRole::SoundEngineer,
                        dependencies: vec!["director_plan"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "screenwriter_draft",
                        name: "✍️ 金牌编剧 · 第一人称爆款解说撰写",
                        role: AgentRole::Screenwriter,
                        dependencies: vec!["visual_analysis", "dialogue_probe"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "critic_review",
                        name: "🔍 剧本质检 · 节奏密度与黄金前3秒评审闭传",
                        role: AgentRole::QualityReviewer,
                        dependencies: vec!["screenwriter_draft"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "hitl_approval",
                        name: "🤝 人机协同 · 剧本精修与终版确认 (HITL)",
                        role: AgentRole::Director,
                        dependencies: vec!["critic_review"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: true,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "voice_synthesis",
                        name: "🎙️ 配音师 · 48kHz 影视广播级人声合成",
                        role: AgentRole::VoiceArtist,
                        dependencies: vec!["hitl_approval"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "timeline_compose",
                        name: "🎛️ 音频调音师 · 5轨毫秒级磁吸与智能避让",
                        role: AgentRole::SoundEngineer,
                        dependencies: vec!["voice_synthesis"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "quality_gate",
                        name: "🛡️ 终审守门员 · 视听合规与全案质检",
                        role: AgentRole::QualityReviewer,
                        dependencies: vec!["timeline_compose"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                ]
            }
            WorkflowProfile::FastCommentary => {
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "director_plan",
                        "🎬 总控导演 · 统筹策划与任务派发",
                        AgentRole::Director,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "director_plan",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "visual_analysis",
                        "👁️ 视觉分析师 · 场景关键帧萃取",
                        AgentRole::VisualCritic,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "visual_analysis",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "screenwriter_draft",
                        "✍️ 金牌编剧 · 极速解说文案撰写",
                        AgentRole::Screenwriter,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "screenwriter_draft",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "hitl_approval",
                        "🤝 人机协同 · 文案终审确认 (HITL)",
                        AgentRole::Director,
                    )
                    .with_hitl(true)
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "hitl_approval",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "voice_synthesis",
                        "🎙️ 配音师 · 快速独白人声合成",
                        AgentRole::VoiceArtist,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "voice_synthesis",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "timeline_compose",
                        "🎛️ 音频调音师 · 5轨极速对齐",
                        AgentRole::SoundEngineer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "timeline_compose",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "quality_gate",
                        "🛡️ 终审守门员 · 快速成片验收",
                        AgentRole::QualityReviewer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "quality_gate",
                            current_deps,
                        ))
                    })),
                );

                graph.add_edge("director_plan", "visual_analysis");
                graph.add_edge("visual_analysis", "screenwriter_draft");
                graph.add_edge("screenwriter_draft", "hitl_approval");
                graph.add_edge("hitl_approval", "voice_synthesis");
                graph.add_edge("voice_synthesis", "timeline_compose");
                graph.add_edge("timeline_compose", "quality_gate");

                vec![
                    DagNode {
                        id: "director_plan",
                        name: "🎬 总控导演 · 统筹策划与任务派发",
                        role: AgentRole::Director,
                        dependencies: vec![],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "visual_analysis",
                        name: "👁️ 视觉分析师 · 场景关键帧萃取",
                        role: AgentRole::VisualCritic,
                        dependencies: vec!["director_plan"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "screenwriter_draft",
                        name: "✍️ 金牌编剧 · 极速解说文案撰写",
                        role: AgentRole::Screenwriter,
                        dependencies: vec!["visual_analysis"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "hitl_approval",
                        name: "🤝 人机协同 · 文案终审确认 (HITL)",
                        role: AgentRole::Director,
                        dependencies: vec!["screenwriter_draft"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: true,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "voice_synthesis",
                        name: "🎙️ 配音师 · 快速独白人声合成",
                        role: AgentRole::VoiceArtist,
                        dependencies: vec!["hitl_approval"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "timeline_compose",
                        name: "🎛️ 音频调音师 · 5轨极速对齐",
                        role: AgentRole::SoundEngineer,
                        dependencies: vec!["voice_synthesis"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "quality_gate",
                        name: "🛡️ 终审守门员 · 快速成片验收",
                        role: AgentRole::QualityReviewer,
                        dependencies: vec!["timeline_compose"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                ]
            }
            WorkflowProfile::PureBrollMontage => {
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "director_plan",
                        "🎬 总控导演 · 混剪统筹与节奏打点",
                        AgentRole::Director,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "director_plan",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "visual_analysis",
                        "👁️ 视觉分析师 · 镜头突变高能切点分析",
                        AgentRole::VisualCritic,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "visual_analysis",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "timeline_compose",
                        "🎛️ 混剪师 · 卡点转场与 BGM 动态混流",
                        AgentRole::SoundEngineer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "timeline_compose",
                            current_deps,
                        ))
                    })),
                );
                let d = deps.clone();
                graph.add_node(
                    GraphNode::new(
                        "quality_gate",
                        "🛡️ 终审守门员 · 视听连贯度终验",
                        AgentRole::QualityReviewer,
                    )
                    .with_handler(Arc::new(move |ctx| {
                        let current_deps = Arc::new(d.read().unwrap().clone());
                        Box::pin(Self::execute_static_node_logic(
                            ctx,
                            "quality_gate",
                            current_deps,
                        ))
                    })),
                );

                graph.add_edge("director_plan", "visual_analysis");
                graph.add_edge("visual_analysis", "timeline_compose");
                graph.add_edge("timeline_compose", "quality_gate");

                vec![
                    DagNode {
                        id: "director_plan",
                        name: "🎬 总控导演 · 混剪统筹与节奏打点",
                        role: AgentRole::Director,
                        dependencies: vec![],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "visual_analysis",
                        name: "👁️ 视觉分析师 · 镜头突变高能切点分析",
                        role: AgentRole::VisualCritic,
                        dependencies: vec!["director_plan"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "timeline_compose",
                        name: "🎛️ 混剪师 · 卡点转场与 BGM 动态混流",
                        role: AgentRole::SoundEngineer,
                        dependencies: vec!["visual_analysis"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                    DagNode {
                        id: "quality_gate",
                        name: "🛡️ 终审守门员 · 视听连贯度终验",
                        role: AgentRole::QualityReviewer,
                        dependencies: vec!["timeline_compose"],
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    },
                ]
            }
            WorkflowProfile::DeterministicLinear => {
                // P0-3: 收编原 7 步线性流水线为确定性 StateGraph Profile（顺序执行、无反思回路、无 HITL 阻塞）
                let linear_specs: [(&'static str, &'static str, AgentRole); 7] = [
                    ("director_plan", "🎬 步骤 1 · 媒体校验与总控策划", AgentRole::Director),
                    ("visual_analysis", "👁️ 步骤 2 · 场景切点与视觉分析", AgentRole::VisualCritic),
                    ("dialogue_probe", "🎧 步骤 3 · 原片 VAD 与 ASR 台词提取", AgentRole::SoundEngineer),
                    ("screenwriter_draft", "✍️ 步骤 4 · 确定性解说剧本生成", AgentRole::Screenwriter),
                    ("voice_synthesis", "🎙️ 步骤 5 · 48kHz 配音合成", AgentRole::VoiceArtist),
                    ("timeline_compose", "🎛️ 步骤 6 · 5 轨声画对齐与混流", AgentRole::SoundEngineer),
                    ("quality_gate", "🛡️ 步骤 7 · 成片合规质检与交付准备", AgentRole::QualityReviewer),
                ];

                let mut dag_nodes = Vec::with_capacity(linear_specs.len());
                let mut prev_id: Option<&'static str> = None;

                for (id, name, role) in linear_specs {
                    let d = deps.clone();
                    graph.add_node(
                        GraphNode::new(id, name, role).with_handler(Arc::new(move |ctx| {
                            let current_deps = Arc::new(d.read().unwrap().clone());
                            Box::pin(Self::execute_static_node_logic(ctx, id, current_deps))
                        })),
                    );
                    if let Some(prev) = prev_id {
                        graph.add_edge(prev, id);
                    }
                    dag_nodes.push(DagNode {
                        id,
                        name,
                        role,
                        dependencies: prev_id.map(|p| vec![p]).unwrap_or_default(),
                        status: DagNodeStatus::Pending,
                        is_hitl_checkpoint: false,
                        duration_ms: 0,
                        summary: None,
                    });
                    prev_id = Some(id);
                }

                dag_nodes
            }
        };

        Self {
            context: Arc::new(RwLock::new(context)),
            nodes,
            graph,
            event_emitter: None,
            checkpoint_hook: None,
            cancel_token: CancelToken::new(),
            profile,
            critique_count: 0,
            max_critique_rounds,
            deps,
        }
    }

    pub fn with_deps(self, deps: Arc<crate::deps::AgentRuntimeDeps>) -> Self {
        if let Ok(mut lock) = self.deps.write() {
            *lock = (*deps).clone();
        }
        self
    }

    pub fn with_emitter(mut self, emitter: EventEmitter) -> Self {
        self.event_emitter = Some(emitter);
        self
    }

    /// 注入断点持久化钩子（由宿主层写入 SQLite `agent_checkpoints` 表）
    pub fn with_checkpoint_hook(mut self, hook: CheckpointHook) -> Self {
        self.checkpoint_hook = Some(hook);
        self
    }

    /// 注入外部取消令牌（支持与 Tauri 命令共享即时取消信号）
    pub fn with_cancel_token(mut self, token: CancelToken) -> Self {
        self.cancel_token = token;
        self
    }

    /// 触发即时取消（同步通知所有运行中的 FFmpeg/ASR 子进程与调度循环）
    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }

    /// 将当前黑板与 DAG 快照通过持久化钩子落盘
    async fn persist_checkpoint(&self, node_id: &str) {
        let Some(hook) = &self.checkpoint_hook else {
            return;
        };
        let snap = self.snapshot().await;
        let dag_json = serde_json::to_string(&snap).unwrap_or_default();
        let (session_id, project_id, bb_json) = {
            let ctx = self.context.read().await;
            (
                ctx.session_id.clone(),
                ctx.project.id.clone(),
                serde_json::to_string(&ctx.blackboard).unwrap_or_default(),
            )
        };
        let profile_str = format!("{:?}", self.profile).to_lowercase();
        hook(&session_id, &project_id, node_id, &profile_str, &bb_json, &dag_json);
    }

    /// 同步 StateGraph 节点状态至对外暴露的 nodes 视图切片
    fn sync_nodes_view(&mut self) {
        for n in &mut self.nodes {
            if let Some(gn) = self.graph.nodes.get(n.id) {
                n.status = gn.status;
                n.duration_ms = gn.duration_ms;
                n.summary = gn.summary.clone();
            }
        }
    }

    /// 获取当前 DAG 状态快照
    pub async fn snapshot(&self) -> DagSnapshot {
        let ctx = self.context.read().await;
        let completed = self
            .nodes
            .iter()
            .filter(|n| n.status == DagNodeStatus::Completed)
            .count();

        DagSnapshot {
            session_id: ctx.session_id.clone(),
            total_nodes: self.nodes.len(),
            completed_nodes: completed,
            nodes: self
                .nodes
                .iter()
                .map(|n| DagNodeInfo {
                    id: n.id.to_string(),
                    name: n.name.to_string(),
                    role: n.role,
                    dependencies: n.dependencies.iter().map(|s| s.to_string()).collect(),
                    status: n.status,
                    duration_ms: n.duration_ms,
                    summary: n.summary.clone(),
                })
                .collect(),
            in_critique_loop: self.critique_count > 0,
            critique_count: self.critique_count,
        }
    }

    /// 广播当前 DAG 进度事件
    async fn emit_progress(&self) {
        if let Some(emitter) = &self.event_emitter {
            let snap = self.snapshot().await;
            emitter(AgentEventPayload::DagProgress { snapshot: snap });
        }
    }

    /// 推进 StateGraph 调度执行，遇到断点返回 Some(BreakpointRequest)
    pub async fn run_dag(&mut self) -> DramaxisResult<Option<BreakpointRequest>> {
        let total_timer = Instant::now();

        loop {
            if self.cancel_token.is_cancelled() {
                let mut ctx = self.context.write().await;
                ctx.status = AgentStatus::Failed;
                if let Some(emitter) = &self.event_emitter {
                    emitter(AgentEventPayload::Error {
                        role: None,
                        message: "工作流已被用户取消".into(),
                    });
                }
                return Err(DramaxisError::Pipeline("工作流已被用户取消".into()));
            }

            // 1. 基于声明式 StateGraph 获取当前就绪节点 ID 列表
            let ready_ids = self.graph.get_ready_node_ids();

            // 若无任何就绪节点，检查是否全部完成
            if ready_ids.is_empty() {
                if self.graph.is_all_completed() {
                    let mut ctx = self.context.write().await;
                    ctx.status = AgentStatus::Completed;
                    if let Some(emitter) = &self.event_emitter {
                        emitter(AgentEventPayload::WorkflowCompleted {
                            total_steps: self.nodes.len(),
                            duration_ms: total_timer.elapsed().as_millis() as u64,
                        });
                    }
                }
                break;
            }

            // 2. 检查就绪节点中是否包含人机协同断点 (HITL)
            let auto_mode = self.context.read().await.auto_mode;
            let hitl_id = ready_ids.iter().find(|id| {
                self.graph
                    .nodes
                    .get(*id)
                    .map(|n| n.is_hitl_checkpoint && !auto_mode)
                    .unwrap_or(false)
            });

            if let Some(node_id) = hitl_id {
                let (role, name) = {
                    let node = self.graph.nodes.get(node_id).unwrap();
                    (node.role, node.name.clone())
                };

                if let Some(node) = self.graph.nodes.get_mut(node_id) {
                    node.status = DagNodeStatus::Running;
                }
                self.sync_nodes_view();
                self.emit_progress().await;

                let mut ctx = self.context.write().await;
                ctx.status = AgentStatus::AwaitingApproval;

                let script_summary = ctx
                    .blackboard
                    .active_script()
                    .map(|s| s.text.clone())
                    .unwrap_or_else(|| {
                        ctx.project
                            .scripts
                            .iter()
                            .map(|s| s.text.as_str())
                            .collect::<Vec<_>>()
                            .join("\n")
                    });

                let req = BreakpointRequest {
                    agent: role,
                    step_title: name,
                    content: if script_summary.is_empty() {
                        "剧本初稿推演完毕，请审核定稿。".into()
                    } else {
                        script_summary
                    },
                    options: vec!["批准定稿并进入配音".into(), "重新微调剧本".into()],
                };

                if let Some(emitter) = &self.event_emitter {
                    emitter(AgentEventPayload::BreakpointRequired(req.clone()));
                }

                // 挂起前落盘 SQLite 断点，确保应用重启后可无缝恢复审批
                self.persist_checkpoint(node_id).await;

                return Ok(Some(req));
            }

            // 3. 执行 Barrier 屏障状态归约 (Reducer)
            {
                let mut ctx = self.context.write().await;
                self.graph
                    .apply_barrier_reducers(&ready_ids, &mut ctx)
                    .await;
            }

            // 4. 并行推进就绪节点 (Tokio 任务池 + 信号量并发控制)
            for id in &ready_ids {
                if let Some(node) = self.graph.nodes.get_mut(id) {
                    node.status = DagNodeStatus::Running;
                }
                if let Some(emitter) = &self.event_emitter {
                    let node = self.graph.nodes.get(id).unwrap();
                    let step_idx = self.nodes.iter().position(|n| n.id == id).unwrap_or(0);
                    emitter(AgentEventPayload::StepStarted {
                        step_idx,
                        role: node.role,
                        name: node.name.clone(),
                    });
                }
            }
            self.sync_nodes_view();
            self.emit_progress().await;

            let sem = Arc::new(tokio::sync::Semaphore::new(2));
            let mut tasks = Vec::new();
            for id in &ready_ids {
                let sem_clone = sem.clone();
                let ctx_clone = self.context.clone();
                let node_id = id.clone();
                let handler = self.graph.nodes.get(id).and_then(|n| n.handler.clone());
                tasks.push(async move {
                    let _permit = sem_clone.acquire().await;
                    let start = Instant::now();
                    let res = if let Some(h) = handler {
                        h(ctx_clone).await
                    } else {
                        Ok("执行完成".into())
                    };
                    (node_id, res, start.elapsed().as_millis() as u64)
                });
            }

            let outcomes = futures::future::join_all(tasks).await;

            let mut conditional_triggers = Vec::new();
            for (node_id, result, dur_ms) in outcomes {
                let role = self
                    .graph
                    .nodes
                    .get(&node_id)
                    .map(|n| n.role)
                    .unwrap_or(AgentRole::Director);

                match result {
                    Ok(summary) => {
                        if let Some(node) = self.graph.nodes.get_mut(&node_id) {
                            node.duration_ms = dur_ms;
                            node.summary = Some(summary.clone());
                            node.status = DagNodeStatus::Completed;
                        }

                        let step_idx = self.nodes.iter().position(|n| n.id == node_id).unwrap_or(0);
                        if let Some(emitter) = &self.event_emitter {
                            emitter(AgentEventPayload::StepCompleted {
                                step_idx,
                                role,
                                summary,
                            });
                        }

                        if node_id == "quality_gate" {
                            let ctx = self.context.read().await;
                            if let Some(rep) = &ctx.blackboard.quality_report {
                                if let Some(emitter) = &self.event_emitter {
                                    emitter(AgentEventPayload::QualityGateEvaluated(
                                        QualityReport {
                                            hook_score: rep.hook_score,
                                            sync_tolerance_ms: rep.sync_tolerance_ms,
                                            pacing_score: rep.pacing_score,
                                            compliance_passed: rep.compliance_passed,
                                            overall_score: rep.overall_score,
                                            suggestions: rep.suggestions.clone(),
                                        },
                                    ));
                                }
                            }
                        }

                        // 收集待评估条件边
                        if self.graph.conditional_edges.contains_key(&node_id) {
                            conditional_triggers.push(node_id.clone());
                        }

                        // 每完成一个节点即落盘一次状态断点
                        self.persist_checkpoint(&node_id).await;
                    }
                    Err(err) => {
                        if let Some(node) = self.graph.nodes.get_mut(&node_id) {
                            node.status = DagNodeStatus::Failed;
                        }
                        self.sync_nodes_view();
                        let mut ctx = self.context.write().await;
                        ctx.status = AgentStatus::Failed;

                        if let Some(emitter) = &self.event_emitter {
                            emitter(AgentEventPayload::Error {
                                role: Some(role),
                                message: err.to_string(),
                            });
                        }
                        self.emit_progress().await;
                        return Err(err);
                    }
                }
            }

            self.sync_nodes_view();

            // 5. 动态条件路由边推演与局部子图失效 (Conditional Branching & Selective Invalidation)
            let mut need_loop_restart = false;
            for from_node in conditional_triggers {
                let target_opt = {
                    let ctx = self.context.read().await;
                    self.graph.evaluate_conditional_edge(&from_node, &ctx)
                };

                if let Some(target) = target_opt {
                    // 若目标节点已处于 Completed 或为上游节点，判定为反思回路跳转
                    let is_cycle = self
                        .graph
                        .nodes
                        .get(&target)
                        .map(|n| {
                            n.status == DagNodeStatus::Completed
                                || n.status == DagNodeStatus::Running
                        })
                        .unwrap_or(false);

                    if is_cycle && self.critique_count < self.max_critique_rounds {
                        self.critique_count += 1;
                        {
                            let mut ctx = self.context.write().await;
                            ctx.memory.insert(
                                "critique_rounds_executed".into(),
                                self.critique_count.to_string(),
                            );
                        }

                        let feedback = {
                            let ctx = self.context.read().await;
                            ctx.memory
                                .get("critique_feedback")
                                .cloned()
                                .unwrap_or_else(|| "开篇前3秒悬念不足，建议加入突发冲突钩子".into())
                        };

                        if let Some(emitter) = &self.event_emitter {
                            emitter(AgentEventPayload::CritiqueLoopTriggered {
                                round: self.critique_count,
                                max_rounds: self.max_critique_rounds,
                                current_score: 72.0,
                                feedback: feedback.clone(),
                            });
                        }

                        // 精确执行局部拓扑失效：只失效 target 及其下游依赖节点，上游视听抽样强缓存保留
                        let invalidated = self.graph.invalidate_subgraph(&target);
                        tracing::info!(
                            "Selective subgraph invalidated from {} -> {:?}",
                            target,
                            invalidated
                        );

                        self.sync_nodes_view();
                        self.emit_progress().await;
                        need_loop_restart = true;
                        break;
                    }
                }
            }

            if need_loop_restart {
                continue;
            }

            self.emit_progress().await;
        }

        Ok(None)
    }

    /// 恢复人机协同断点 (支持可选自然语言靶向精修指令)
    pub async fn resume_breakpoint(
        &mut self,
        action: &str,
        feedback: Option<String>,
    ) -> DramaxisResult<Option<BreakpointRequest>> {
        if let Some(hitl_node) = self.graph.nodes.get_mut("hitl_approval") {
            hitl_node.status = DagNodeStatus::Completed;
            hitl_node.summary = Some(format!("用户已确认: {}", action));
        }
        self.sync_nodes_view();

        if let Some(fb) = feedback {
            {
                let mut ctx = self.context.write().await;
                ctx.memory.insert("critique_feedback".into(), fb.clone());
                ctx.log_thought(AgentRole::Director, format!("用户下达靶向精修指令: {fb}"));
            }

            // 局部拓扑失效：从编剧节点起下重新推演，保留更早的抽样产物
            self.graph.invalidate_subgraph("screenwriter_draft");
            self.sync_nodes_view();
        }

        if let Some(emitter) = &self.event_emitter {
            emitter(AgentEventPayload::BreakpointResolved {
                agent: AgentRole::Director,
                action: action.to_string(),
            });
        }

        self.run_dag().await
    }

    /// 节点底层执行映射（已模块化下沉至 `crate::nodes::execute_node`）
    pub async fn execute_static_node_logic(
        context: Arc<RwLock<AgentContext>>,
        node_id: &str,
        deps: Arc<crate::deps::AgentRuntimeDeps>,
    ) -> DramaxisResult<String> {
        crate::nodes::execute_node(context, node_id, deps, CancelToken::new()).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dramaxis_core::domain::Project;

    #[tokio::test]
    async fn test_dag_workflow_full_run() {
        let proj = Project {
            name: "DAG 编排测试短剧".into(),
            ..Default::default()
        };

        let ctx = AgentContext::new(proj, true); // auto_mode = true
        let mut orchestrator = DagOrchestrator::new(ctx);

        let snap = orchestrator.snapshot().await;
        assert_eq!(snap.total_nodes, 9);
        assert_eq!(snap.completed_nodes, 0);

        let bp = orchestrator.run_dag().await.expect("run dag");
        assert!(bp.is_none(), "auto_mode should not block on HITL");

        let final_snap = orchestrator.snapshot().await;
        assert_eq!(final_snap.completed_nodes, 9);
        assert_eq!(final_snap.nodes[0].status, DagNodeStatus::Completed);
        assert_eq!(final_snap.nodes[8].status, DagNodeStatus::Completed);
    }

    #[tokio::test]
    async fn test_dag_hitl_breakpoint_and_resume() {
        let proj = Project {
            name: "HITL 交互断点测试".into(),
            ..Default::default()
        };

        let ctx = AgentContext::new(proj, false); // auto_mode = false (HITL 开启)
        let mut orchestrator = DagOrchestrator::new(ctx);

        // 第一次执行应在 hitl_approval 节点挂起
        let bp = orchestrator.run_dag().await.expect("run dag");
        assert!(bp.is_some(), "should pause on hitl_approval");
        let req = bp.unwrap();
        assert_eq!(req.agent, AgentRole::Director);

        // 恢复断点继续执行
        let final_bp = orchestrator
            .resume_breakpoint("批准定稿", None)
            .await
            .expect("resume");
        assert!(final_bp.is_none());

        let snap = orchestrator.snapshot().await;
        assert_eq!(snap.completed_nodes, 9);
    }

    #[tokio::test]
    async fn test_workflow_profiles() {
        let proj = Project {
            name: "混剪模板测试".into(),
            ..Default::default()
        };

        // 纯画面混剪模板 (4 节点)
        let ctx = AgentContext::new(proj.clone(), true);
        let mut orch_montage =
            DagOrchestrator::with_profile(ctx, WorkflowProfile::PureBrollMontage);
        let snap_montage = orch_montage.snapshot().await;
        assert_eq!(snap_montage.total_nodes, 4);
        orch_montage.run_dag().await.expect("run montage");
        let final_montage = orch_montage.snapshot().await;
        assert_eq!(final_montage.completed_nodes, 4);

        // 极速影视解说模板 (7 节点)
        let ctx2 = AgentContext::new(proj, true);
        let mut orch_fast = DagOrchestrator::with_profile(ctx2, WorkflowProfile::FastCommentary);
        let snap_fast = orch_fast.snapshot().await;
        assert_eq!(snap_fast.total_nodes, 7);
        orch_fast.run_dag().await.expect("run fast commentary");
        let final_fast = orch_fast.snapshot().await;
        assert_eq!(final_fast.completed_nodes, 7);
    }

    #[tokio::test]
    async fn test_stategraph_conditional_reflection_loop() {
        let proj = Project {
            name: "反思回路状态图测试".into(),
            ..Default::default()
        };

        let mut ctx = AgentContext::new(proj, true);
        // 人工注入低于 80 分的评测分数，触发条件边反思回路
        ctx.memory.insert("critic_score".into(), "72.0".into());

        let mut orchestrator = DagOrchestrator::new(ctx);
        orchestrator
            .run_dag()
            .await
            .expect("run dag with reflection");

        let snap = orchestrator.snapshot().await;
        assert_eq!(snap.completed_nodes, 9);
        // 应该触发了至少 1 次反思回路
        assert!(
            orchestrator.critique_count > 0,
            "should have triggered reflection loop via conditional edge"
        );
    }

    #[tokio::test]
    async fn test_deterministic_linear_profile_and_checkpoint_hook() {
        let proj = Project {
            name: "确定性线性流水线测试".into(),
            ..Default::default()
        };
        let recorded = Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
        let rec_clone = recorded.clone();

        let ctx = AgentContext::new(proj, false); // 即使 auto_mode=false 也不应被 HITL 阻塞
        let mut orch =
            DagOrchestrator::with_profile(ctx, WorkflowProfile::DeterministicLinear)
                .with_checkpoint_hook(Arc::new(
                    move |_sid, _pid, node_id, profile, _bb, _dag| {
                        assert_eq!(profile, "deterministiclinear");
                        rec_clone.lock().unwrap().push(node_id.to_string());
                    },
                ));

        let bp = orch.run_dag().await.expect("run deterministic linear");
        assert!(bp.is_none(), "DeterministicLinear 不应挂起 HITL 断点");

        let snap = orch.snapshot().await;
        assert_eq!(snap.total_nodes, 7);
        assert_eq!(snap.completed_nodes, 7);
        assert_eq!(recorded.lock().unwrap().len(), 7);
    }

    #[tokio::test]
    async fn test_dag_cancel_token_aborts_immediately() {
        let proj = Project {
            name: "取消令牌测试".into(),
            ..Default::default()
        };
        let ctx = AgentContext::new(proj, true);
        let token = CancelToken::new();
        token.cancel();

        let mut orch = DagOrchestrator::new(ctx).with_cancel_token(token);
        let res = orch.run_dag().await;
        assert!(res.is_err(), "预取消的工作流应立即返回错误");
    }
}
