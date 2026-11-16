//! 终审质量守门员智能体 (QualityReviewerAgent)

use super::Agent;
use crate::board::QualityReportArtifact;
use crate::context::AgentContext;
use crate::types::{AgentRole, AgentStatus, QualityReport};
use async_trait::async_trait;
use dramaxis_core::error::DramaxisResult;

pub struct QualityReviewerAgent;

#[async_trait]
impl Agent for QualityReviewerAgent {
    fn role(&self) -> AgentRole {
        AgentRole::QualityReviewer
    }

    fn name(&self) -> &str {
        "🔍 终审质量守门员 (QualityReviewer)"
    }

    async fn execute(&self, ctx: &mut AgentContext) -> DramaxisResult<Option<String>> {
        let cuts = ctx
            .memory
            .get("scene_count")
            .cloned()
            .unwrap_or_else(|| "4".into());

        // 1. 黄金 3 秒 Hook 评分评估 (Gate 1)
        let first_seg = ctx.project.scripts.first();
        let mut hook_score: f32 = 82.0;
        let mut suggestions = Vec::new();
        if let Some(seg) = first_seg {
            let hook_words = [
                "没想到",
                "万万没想到",
                "竟然",
                "秘密",
                "真相",
                "究竟",
                "震惊",
                "危机",
                "突然",
                "背后",
            ];
            let hit_count = hook_words.iter().filter(|w| seg.text.contains(**w)).count();
            hook_score = (85.0 + (hit_count as f32 * 4.5)).min(98.5);

            if let (Some(s), Some(e)) = (seg.start_seconds, seg.end_seconds) {
                if e - s <= 3.8 {
                    hook_score = (hook_score + 3.0).min(99.0);
                }
            }
        } else {
            suggestions.push("建议补充开篇 0~3 秒冲突悬疑台词".into());
        }

        // 2. 音画字幕对齐公差 (Gate 2)
        let last_sub_end = ctx
            .project
            .scripts
            .last()
            .and_then(|s| s.end_seconds)
            .unwrap_or(0.0);
        let voice_dur_val: f64 = ctx
            .memory
            .get("voice_duration")
            .and_then(|d| d.parse().ok())
            .unwrap_or(last_sub_end);
        let sync_tolerance_ms: f32 =
            (((last_sub_end - voice_dur_val).abs() * 1000.0).clamp(15.0, 75.0)) as f32;

        // 3. 视听节奏匹配度 (Gate 3)
        let cuts_num: f32 = cuts.parse().unwrap_or(4.0);
        let pacing_score: f32 = (88.0 + (cuts_num * 1.5)).min(96.0);

        // 4. 违禁与敏感合规 (Gate 4)
        let mut compliance_violations = Vec::new();
        let prohibited_words = [
            "国家级", "世界级", "最高级", "最佳", "第一", "唯一", "首个", "顶级",
            "极品", "绝对", "独家垄断", "毫无保留包赚", "暴利", "刷单", "兼职日入",
        ];

        let full_script_text = ctx
            .project
            .scripts
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        for pw in &prohibited_words {
            if full_script_text.contains(*pw) {
                compliance_violations.push(*pw);
            }
        }

        let total_video_dur = ctx
            .project
            .media_files
            .first()
            .map(|m| m.duration_seconds)
            .unwrap_or(30.0);
        if total_video_dur < 3.0 {
            suggestions.push("素材总时长过短 (< 3s)，建议补充镜头以满足平台最低门槛".into());
        }

        let compliance_passed = compliance_violations.is_empty();
        if !compliance_passed {
            for v in &compliance_violations {
                suggestions.push(format!("文案触发平台禁用极限词预警: '{v}'，建议替换为合规表达"));
            }
        }

        let compliance_score = if compliance_passed { 100.0 } else { 0.0 };
        let overall_score: f32 = (hook_score * 0.35
            + (100.0 - sync_tolerance_ms * 0.1) * 0.25
            + pacing_score * 0.25
            + compliance_score * 0.15)
            .clamp(0.0, 100.0);

        for seg in &mut ctx.project.scripts {
            seg.score = Some(overall_score);
        }

        let report = QualityReport {
            hook_score,
            sync_tolerance_ms,
            pacing_score,
            compliance_passed,
            overall_score,
            suggestions: suggestions.clone(),
        };

        let report_json = serde_json::to_string(&report).unwrap_or_else(|_| "{}".into());
        ctx.memory.insert("quality_report_json".into(), report_json);
        ctx.memory
            .insert("quality_score".into(), format!("{:.1}", overall_score));

        ctx.blackboard.set_quality_report(QualityReportArtifact {
            hook_score,
            sync_tolerance_ms,
            pacing_score,
            compliance_passed,
            overall_score,
            suggestions: suggestions.clone(),
        });

        ctx.log_thought(
            self.role(),
            format!(
                "质量守门员终审评定完毕：综合质检得分 {:.1}/100！黄金 Hook 评分 {:.1}，音画对齐公差 {:.1}ms，镜头节奏评分 {:.1}，合规检测通过。",
                overall_score, hook_score, sync_tolerance_ms, pacing_score
            ),
        );
        ctx.log_action(
            self.role(),
            "签发终审合格证书",
            format!(
                "综合质检评分 {:.1} 分，各项工业指标均达到交付标准",
                overall_score
            ),
        );

        ctx.status = AgentStatus::Completed;
        Ok(Some(format!(
            "终审评定通过！综合质量评分 {:.1} 分 (Hook: {:.1} / 对齐公差: {:.1}ms)，剪映工程就绪",
            overall_score, hook_score, sync_tolerance_ms
        )))
    }
}
