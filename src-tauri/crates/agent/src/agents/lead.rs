//! 总控统筹导演智能体 (DirectorAgent)

use super::Agent;
use crate::context::AgentContext;
use crate::types::AgentRole;
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;

pub struct DirectorAgent;

#[async_trait]
impl Agent for DirectorAgent {
    fn role(&self) -> AgentRole {
        AgentRole::Director
    }

    fn name(&self) -> &str {
        "🎬 总控导演 (Director)"
    }

    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>> {
        let media_count = ctx.project.media_files.len();
        let project_name = &ctx.project.name;

        ctx.log_thought(
            self.role(),
            format!(
                "初始化工程【{}】，挂载 {} 个视频素材，正调度 6 专家智能体自主生产工作群...",
                project_name, media_count
            ),
        );
        ctx.log_action(
            self.role(),
            "派发任务",
            format!(
                "向视觉分析师派发 {} 组视频素材的多模态分镜切片与高能帧抽取任务",
                media_count
            ),
        );
        Ok(Some(format!(
            "总控导演已激活，已装载 {} 个视频素材",
            media_count
        )))
    }
}
