use dramaxis_agent::{AgentContext, AgentEventPayload, AgentOrchestrator, AgentRole, AgentStatus};
use dramaxis_core::domain::{MediaFile, Project};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[tokio::test]
async fn test_6_agent_orchestrator_full_workflow() {
    let mut project = Project {
        name: "绝命逆袭之真相".into(),
        ..Default::default()
    };
    project.media_files.push(MediaFile {
        path: std::path::PathBuf::from("/tmp/sample_test.mp4"),
        duration_seconds: 45.0,
        resolution: Some("1080x1920".into()),
        codec: Some("h264".into()),
        file_size_bytes: 1024 * 1024 * 5,
        import_time: chrono::Utc::now(),
    });

    let context = AgentContext::new(project, true);
    let event_count = Arc::new(AtomicUsize::new(0));
    let quality_evaluated_fired = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let ec = event_count.clone();
    let qf = quality_evaluated_fired.clone();
    let emitter = Arc::new(move |payload: AgentEventPayload| {
        ec.fetch_add(1, Ordering::SeqCst);
        if let AgentEventPayload::QualityGateEvaluated(report) = payload {
            assert!(report.overall_score >= 80.0);
            assert!(report.hook_score >= 80.0);
            assert!(report.sync_tolerance_ms <= 100.0);
            qf.store(true, Ordering::SeqCst);
        }
    });

    let orchestrator = AgentOrchestrator::new(context).with_emitter(emitter);

    // 运行全部 6 个 Agent 节点
    for step in 0..6 {
        let bp = orchestrator.run_step(step).await.unwrap();
        assert!(bp.is_none(), "全自动模式下不应该产生阻断断点");
    }

    let ctx = orchestrator.context().await;
    let guard = ctx.read().await;

    // 1. 验证总状态
    assert_eq!(guard.status, AgentStatus::Completed);

    // 2. 验证每个 Agent 留存的 Memory 数据
    assert!(guard.memory.contains_key("scene_count"));
    assert!(guard.memory.contains_key("script_text"));
    assert!(guard.memory.contains_key("voice_duration"));
    assert!(guard.memory.contains_key("subtitles_json"));
    assert!(guard.memory.contains_key("quality_score"));
    assert!(guard.memory.contains_key("quality_report_json"));

    // 3. 验证 SoundEngineer 挂载的 5 轨时间线
    assert_eq!(guard.project.timeline.tracks.len(), 5);
    assert_eq!(guard.project.timeline.tracks[0].clips.len(), 1); // V1 视频
    assert!(!guard.project.timeline.tracks[4].clips.is_empty()); // SUB 字幕

    // 4. 验证 ScriptSegment 质量评分被 QualityReviewer 回写
    assert!(!guard.project.scripts.is_empty());
    let first_seg = &guard.project.scripts[0];
    assert!(first_seg.is_hook == Some(true));
    assert!(first_seg.score.is_some());
    assert!(first_seg.score.unwrap() >= 80.0);

    // 5. 验证 QualityGateEvaluated 事件被触发
    assert!(quality_evaluated_fired.load(Ordering::SeqCst));
    assert!(event_count.load(Ordering::SeqCst) >= 12);
}

#[tokio::test]
async fn test_agent_orchestrator_hitl_breakpoint() {
    let project = Project {
        name: "HITL 人机协作测试".into(),
        ..Default::default()
    };

    // auto_mode = false，触发人工协同断点
    let context = AgentContext::new(project, false);
    let orchestrator = AgentOrchestrator::new(context);

    // Step 0: Director (自动通过)
    let bp0 = orchestrator.run_step(0).await.unwrap();
    assert!(bp0.is_none());

    // Step 1: VisualCritic (自动通过)
    let bp1 = orchestrator.run_step(1).await.unwrap();
    assert!(bp1.is_none());

    // Step 2: Screenwriter (触发断点)
    let bp2 = orchestrator.run_step(2).await.unwrap();
    assert!(bp2.is_some(), "编剧节点应该触发人工断点确认");
    let req = bp2.unwrap();
    assert_eq!(req.agent, AgentRole::Screenwriter);
    assert!(!req.content.is_empty());
    assert_eq!(req.options.len(), 2);
}
