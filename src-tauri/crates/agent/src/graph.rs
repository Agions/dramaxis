//! dramaxis-agent::graph · 声明式动态状态图 (StateGraph) 编排引擎
//!
//! 借鉴 LangGraph / Pregel 计算图模型，提供：
//! 1. **节点 (GraphNode)**：具备强类型状态访问、异步处理与优雅降级能力的执行单元
//! 2. **静态依赖边 (DirectEdge)**：定义拓扑先后序与数据依赖
//! 3. **动态条件路由边 (ConditionalEdge)**：根据运行态状态快照动态计算下一跃迁节点（如反思闭环）
//! 4. **同步屏障 (SyncBarrier) 与状态归约 (StateReducer)**：并行分支汇聚时原子合并黑板产物
//! 5. **子图局部拓扑失效 (invalidate_subgraph)**：反思回退时仅失效受影响下游，完好前置强缓存

use crate::types::{AgentRole, DagNodeStatus};
use dramaxis_core::{DramaxisError, DramaxisResult};
use std::collections::{HashMap, HashSet, VecDeque};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::RwLock;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// 节点异步处理函数类型
pub type NodeHandler<S> =
    Arc<dyn Fn(Arc<RwLock<S>>) -> BoxFuture<'static, DramaxisResult<String>> + Send + Sync>;

/// 状态归约回调函数类型 (Barrier Reducer)
pub type StateReducer<S> = Arc<dyn Fn(&mut S) + Send + Sync>;

/// 条件路由函数：基于当前全局状态只读快照计算下一个跳转节点 ID
pub type ConditionRouter<S> = Arc<dyn Fn(&S) -> String + Send + Sync>;

/// 动态状态图中的节点实体
#[derive(Clone)]
pub struct GraphNode<S> {
    pub id: String,
    pub name: String,
    pub role: AgentRole,
    pub is_hitl_checkpoint: bool,
    pub status: DagNodeStatus,
    pub duration_ms: u64,
    pub summary: Option<String>,
    pub handler: Option<NodeHandler<S>>,
    pub fallback_handler: Option<NodeHandler<S>>,
}

impl<S> GraphNode<S> {
    pub fn new(id: impl Into<String>, name: impl Into<String>, role: AgentRole) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            role,
            is_hitl_checkpoint: false,
            status: DagNodeStatus::Pending,
            duration_ms: 0,
            summary: None,
            handler: None,
            fallback_handler: None,
        }
    }

    pub fn with_hitl(mut self, is_hitl: bool) -> Self {
        self.is_hitl_checkpoint = is_hitl;
        self
    }

    pub fn with_handler(mut self, handler: NodeHandler<S>) -> Self {
        self.handler = Some(handler);
        self
    }

    pub fn with_fallback(mut self, fallback: NodeHandler<S>) -> Self {
        self.fallback_handler = Some(fallback);
        self
    }
}

/// 并发汇聚同步屏障
pub struct SyncBarrier<S> {
    pub target_node: String,
    pub required_dependencies: Vec<String>,
    pub reducer: Option<StateReducer<S>>,
    pub reducer_applied: bool,
}

/// 声明式动态状态图 (StateGraph)
pub struct StateGraph<S> {
    pub nodes: HashMap<String, GraphNode<S>>,
    pub order: Vec<String>,
    pub direct_edges: Vec<(String, String)>, // (from, to)
    pub conditional_edges: HashMap<String, (ConditionRouter<S>, Vec<String>)>, // from -> (router, possible_targets)
    pub barriers: HashMap<String, SyncBarrier<S>>, // target_node -> Barrier
}

impl<S: Send + Sync + 'static> Default for StateGraph<S> {
    fn default() -> Self {
        Self::new()
    }
}

impl<S: Send + Sync + 'static> StateGraph<S> {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            order: Vec::new(),
            direct_edges: Vec::new(),
            conditional_edges: HashMap::new(),
            barriers: HashMap::new(),
        }
    }

    /// 添加状态图节点
    pub fn add_node(&mut self, node: GraphNode<S>) -> &mut Self {
        let id = node.id.clone();
        if !self.nodes.contains_key(&id) {
            self.order.push(id.clone());
        }
        self.nodes.insert(id, node);
        self
    }

    /// 添加静态依赖边 (from 执行完成后作为 to 的就绪条件)
    pub fn add_edge(&mut self, from: impl Into<String>, to: impl Into<String>) -> &mut Self {
        let f = from.into();
        let t = to.into();
        self.direct_edges.push((f, t));
        self
    }

    /// 添加条件路由边 (from 执行完成后，根据 router 决策跳转目标)
    pub fn add_conditional_edge(
        &mut self,
        from: impl Into<String>,
        router: ConditionRouter<S>,
        possible_targets: Vec<String>,
    ) -> &mut Self {
        self.conditional_edges
            .insert(from.into(), (router, possible_targets));
        self
    }

    /// 添加并发汇聚同步屏障 (target_node 必须等待所有 required 节点完成，并可选执行状态归约)
    pub fn add_barrier(
        &mut self,
        target_node: impl Into<String>,
        required_dependencies: Vec<String>,
        reducer: Option<StateReducer<S>>,
    ) -> &mut Self {
        let target = target_node.into();
        // 自动为所有 required 节点向 target 添加直接边
        for req in &required_dependencies {
            if !self.direct_edges.iter().any(|(f, t)| f == req && t == &target) {
                self.direct_edges.push((req.clone(), target.clone()));
            }
        }
        self.barriers.insert(
            target.clone(),
            SyncBarrier {
                target_node: target,
                required_dependencies,
                reducer,
                reducer_applied: false,
            },
        );
        self
    }

    /// 获取某个节点的所有前置直接依赖 ID
    pub fn dependencies_of(&self, node_id: &str) -> Vec<String> {
        let mut deps = Vec::new();
        for (from, to) in &self.direct_edges {
            if to == node_id && !deps.contains(from) {
                deps.push(from.clone());
            }
        }
        if let Some(barrier) = self.barriers.get(node_id) {
            for req in &barrier.required_dependencies {
                if !deps.contains(req) {
                    deps.push(req.clone());
                }
            }
        }
        deps
    }

    /// 获取某个节点的所有下游后继节点 ID
    pub fn successors_of(&self, node_id: &str) -> Vec<String> {
        let mut succs = Vec::new();
        for (from, to) in &self.direct_edges {
            if from == node_id && !succs.contains(to) {
                succs.push(to.clone());
            }
        }
        for (target, barrier) in &self.barriers {
            if barrier.required_dependencies.iter().any(|r| r == node_id) && !succs.contains(target) {
                succs.push(target.clone());
            }
        }
        succs
    }

    /// 寻找当前所有前置依赖已满足且自身处于 Pending 状态的就绪节点
    pub fn get_ready_node_ids(&self) -> Vec<String> {
        self.order
            .iter()
            .filter(|&id| {
                let node = match self.nodes.get(id) {
                    Some(n) => n,
                    None => return false,
                };
                if node.status != DagNodeStatus::Pending {
                    return false;
                }

                // 检查所有依赖是否为 Completed
                let deps = self.dependencies_of(id);
                deps.iter().all(|dep_id| {
                    self.nodes
                        .get(dep_id)
                        .map(|n| n.status == DagNodeStatus::Completed)
                        .unwrap_or(false)
                })
            })
            .cloned()
            .collect()
    }

    /// 检查并执行就绪节点的前置 Barrier 状态归约 (Reducer)
    pub async fn apply_barrier_reducers(&mut self, ready_ids: &[String], state: &mut S) {
        for id in ready_ids {
            if let Some(barrier) = self.barriers.get_mut(id) {
                if !barrier.reducer_applied {
                    let all_met = barrier.required_dependencies.iter().all(|req| {
                        self.nodes
                            .get(req)
                            .map(|n| n.status == DagNodeStatus::Completed)
                            .unwrap_or(false)
                    });
                    if all_met {
                        if let Some(ref reducer) = barrier.reducer {
                            reducer(state);
                        }
                        barrier.reducer_applied = true;
                    }
                }
            }
        }
    }

    /// 拓扑子图局部失效重算 (Selective Subgraph Invalidation)
    ///
    /// 从 start_node_id 开始，根据后继拓扑有向边进行 BFS 遍历，将自身及所有依赖受影响的下游节点
    /// 状态重置为 Pending，而上游无关完好节点（如视觉与音频分析）产物完全保留缓存。
    pub fn invalidate_subgraph(&mut self, start_node_id: &str) -> Vec<String> {
        let mut invalidated = Vec::new();
        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();

        if self.nodes.contains_key(start_node_id) {
            queue.push_back(start_node_id.to_string());
            visited.insert(start_node_id.to_string());
        }

        while let Some(curr) = queue.pop_front() {
            invalidated.push(curr.clone());

            // 查找所有下游节点
            for succ in self.successors_of(&curr) {
                if !visited.contains(&succ) {
                    visited.insert(succ.clone());
                    queue.push_back(succ);
                }
            }
        }

        // 将收集到的全部节点重置
        for id in &invalidated {
            if let Some(node) = self.nodes.get_mut(id) {
                node.status = DagNodeStatus::Pending;
                node.duration_ms = 0;
                node.summary = None;
            }
            if let Some(barrier) = self.barriers.get_mut(id) {
                barrier.reducer_applied = false;
            }
        }

        invalidated
    }

    /// 评估条件路由边：如果 from_node 存在条件边，根据当前 state 决定下一个路由目标
    pub fn evaluate_conditional_edge(&self, from_node: &str, state: &S) -> Option<String> {
        if let Some((router, _possible)) = self.conditional_edges.get(from_node) {
            let target = router(state);
            Some(target)
        } else {
            None
        }
    }

    /// 判断图是否全部执行完毕
    pub fn is_all_completed(&self) -> bool {
        self.nodes.values().all(|n| {
            n.status == DagNodeStatus::Completed || n.status == DagNodeStatus::Skipped
        })
    }

    /// 执行节点（支持优雅降级 Fallback）
    pub async fn execute_node(
        &self,
        node_id: &str,
        state: Arc<RwLock<S>>,
    ) -> DramaxisResult<String> {
        let node = self
            .nodes
            .get(node_id)
            .ok_or_else(|| DramaxisError::Pipeline(format!("Node {} not found in StateGraph", node_id)))?;

        let handler = match &node.handler {
            Some(h) => h.clone(),
            None => {
                return Ok(format!("Node {node_id} executed (no-op)"));
            }
        };

        match handler(state.clone()).await {
            Ok(res) => Ok(res),
            Err(primary_err) => {
                // 尝试执行策略级优雅降级
                if let Some(ref fallback) = node.fallback_handler {
                    tracing::warn!(
                        "Node {} primary execution failed: {}. Attempting fallback...",
                        node_id,
                        primary_err
                    );
                    let fallback_fn = fallback.clone();
                    match fallback_fn(state).await {
                        Ok(fallback_res) => {
                            Ok(format!("{fallback_res} [已触发策略级优雅降级]"))
                        }
                        Err(fallback_err) => {
                            Err(DramaxisError::Pipeline(format!(
                                "Node {node_id} failed primary ({primary_err}) and fallback ({fallback_err})"
                            )))
                        }
                    }
                } else {
                    Err(primary_err)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default, Clone)]
    #[allow(dead_code)]
    struct MockState {
        pub counter: u32,
        pub visual_done: bool,
        pub audio_done: bool,
        pub script_merged: bool,
        pub critic_score: f32,
        pub critique_rounds: u32,
    }

    #[tokio::test]
    async fn test_state_graph_linear_execution() {
        let mut graph = StateGraph::<MockState>::new();
        graph.add_node(
            GraphNode::new("step1", "第一步", AgentRole::Director).with_handler(Arc::new(
                |state| {
                    Box::pin(async move {
                        let mut s = state.write().await;
                        s.counter += 1;
                        Ok("Step 1 done".into())
                    })
                },
            )),
        );
        graph.add_node(
            GraphNode::new("step2", "第二步", AgentRole::Screenwriter).with_handler(Arc::new(
                |state| {
                    Box::pin(async move {
                        let mut s = state.write().await;
                        s.counter += 10;
                        Ok("Step 2 done".into())
                    })
                },
            )),
        );
        graph.add_edge("step1", "step2");

        let state = Arc::new(RwLock::new(MockState::default()));

        // 初始就绪应为 step1
        let ready = graph.get_ready_node_ids();
        assert_eq!(ready, vec!["step1"]);

        // 执行 step1
        let res = graph.execute_node("step1", state.clone()).await.unwrap();
        assert_eq!(res, "Step 1 done");
        graph.nodes.get_mut("step1").unwrap().status = DagNodeStatus::Completed;

        // 此时 step2 就绪
        let ready2 = graph.get_ready_node_ids();
        assert_eq!(ready2, vec!["step2"]);

        let res2 = graph.execute_node("step2", state.clone()).await.unwrap();
        assert_eq!(res2, "Step 2 done");
        graph.nodes.get_mut("step2").unwrap().status = DagNodeStatus::Completed;

        assert!(graph.is_all_completed());
        assert_eq!(state.read().await.counter, 11);
    }

    #[tokio::test]
    async fn test_barrier_and_reducer() {
        let mut graph = StateGraph::<MockState>::new();
        graph.add_node(GraphNode::new("start", "起点", AgentRole::Director));
        graph.add_node(GraphNode::new("branch_a", "视觉分支", AgentRole::VisualCritic));
        graph.add_node(GraphNode::new("branch_b", "音频分支", AgentRole::SoundEngineer));
        graph.add_node(GraphNode::new("join", "汇聚编剧", AgentRole::Screenwriter));

        graph.add_edge("start", "branch_a");
        graph.add_edge("start", "branch_b");

        // 声明屏障与 Reducer
        graph.add_barrier(
            "join",
            vec!["branch_a".into(), "branch_b".into()],
            Some(Arc::new(|s: &mut MockState| {
                s.script_merged = true;
            })),
        );

        let mut state = MockState::default();

        // 完成 start
        graph.nodes.get_mut("start").unwrap().status = DagNodeStatus::Completed;

        // 分支 A 和 B 同时就绪
        let mut ready = graph.get_ready_node_ids();
        ready.sort();
        assert_eq!(ready, vec!["branch_a", "branch_b"]);

        // 仅完成 branch_a，此时 join 不应就绪
        graph.nodes.get_mut("branch_a").unwrap().status = DagNodeStatus::Completed;
        assert_eq!(graph.get_ready_node_ids(), vec!["branch_b"]);

        // 完成 branch_b
        graph.nodes.get_mut("branch_b").unwrap().status = DagNodeStatus::Completed;
        let ready_final = graph.get_ready_node_ids();
        assert_eq!(ready_final, vec!["join"]);

        // 应用 Barrier Reducer
        graph.apply_barrier_reducers(&ready_final, &mut state).await;
        assert!(state.script_merged, "Reducer should have run upon barrier saturation");
    }

    #[tokio::test]
    async fn test_selective_invalidation_and_critic_loop() {
        let mut graph = StateGraph::<MockState>::new();
        graph.add_node(GraphNode::new("prep", "前置抽样", AgentRole::VisualCritic));
        graph.add_node(GraphNode::new("writer", "编剧起稿", AgentRole::Screenwriter));
        graph.add_node(GraphNode::new("critic", "质检验收", AgentRole::QualityReviewer));
        graph.add_node(GraphNode::new("hitl", "人机确认", AgentRole::Director));

        graph.add_edge("prep", "writer");
        graph.add_edge("writer", "critic");
        graph.add_edge("critic", "hitl");

        // 条件路由边：如果分数 < 80 且重试 < 2，回退到 writer，否则前进至 hitl
        graph.add_conditional_edge(
            "critic",
            Arc::new(|s: &MockState| {
                if s.critic_score < 80.0 && s.critique_rounds < 2 {
                    "writer".into()
                } else {
                    "hitl".into()
                }
            }),
            vec!["writer".into(), "hitl".into()],
        );

        // 全部先跑完一轮
        for id in &["prep", "writer", "critic"] {
            graph.nodes.get_mut(*id).unwrap().status = DagNodeStatus::Completed;
        }

        let mut state = MockState {
            critic_score: 70.0, // 未达标
            critique_rounds: 0,
            ..Default::default()
        };

        // 评估条件路由
        let next = graph.evaluate_conditional_edge("critic", &state).unwrap();
        assert_eq!(next, "writer");

        // 局部重算失效：只失效 writer 及其下游（critic, hitl），前置 prep 必须保留 Completed
        let invalidated = graph.invalidate_subgraph(&next);
        assert!(invalidated.contains(&"writer".to_string()));
        assert!(invalidated.contains(&"critic".to_string()));
        assert!(invalidated.contains(&"hitl".to_string()));
        assert!(!invalidated.contains(&"prep".to_string()));

        assert_eq!(graph.nodes.get("prep").unwrap().status, DagNodeStatus::Completed);
        assert_eq!(graph.nodes.get("writer").unwrap().status, DagNodeStatus::Pending);
        assert_eq!(graph.nodes.get("critic").unwrap().status, DagNodeStatus::Pending);

        // 此时 writer 的前置 prep 是 Completed，因此 writer 立即再次就绪
        let ready = graph.get_ready_node_ids();
        assert_eq!(ready, vec!["writer"]);

        // 第二轮：分数达标
        state.critique_rounds = 1;
        state.critic_score = 92.0;
        let next2 = graph.evaluate_conditional_edge("critic", &state).unwrap();
        assert_eq!(next2, "hitl");
    }

    #[tokio::test]
    async fn test_node_graceful_fallback() {
        let mut graph = StateGraph::<MockState>::new();
        graph.add_node(
            GraphNode::new("faulty_node", "故障节点", AgentRole::VoiceArtist)
                .with_handler(Arc::new(|_| {
                    Box::pin(async move {
                        Err(DramaxisError::Pipeline("网络配音服务异常中断".into()))
                    })
                }))
                .with_fallback(Arc::new(|_| {
                    Box::pin(async move {
                        Ok("已降级为离线轻量级合成声学模型".into())
                    })
                })),
        );

        let state = Arc::new(RwLock::new(MockState::default()));
        let res = graph.execute_node("faulty_node", state).await.unwrap();
        assert!(res.contains("已降级为离线轻量级合成声学模型"));
        assert!(res.contains("[已触发策略级优雅降级]"));
    }
}
