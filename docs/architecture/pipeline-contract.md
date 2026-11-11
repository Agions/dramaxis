# 核心流水线契约 (Pipeline Contract)

> 范围：`dramaxis-compose` 的 7 步主流水线。本文是 **输入 / 输出 / 异常 / 取消** 的唯一规范来源，
> 与 `crates/compose/src/lib.rs`（状态机）、`executors.rs`（各步实现）一一对应。
> 修改任一步的契约时，必须同步更新本文与对应单测。

## 1. 状态机

```text
Idle ──start()──▶ Running ──全部成功──▶ Done
                     │
                     ├─步骤返回 Err────▶ Failed   (StepFailed + PipelineFailed)
                     └─步边界检测取消──▶ Failed   (PipelineFailed "流水线已取消")
Done / Failed ──reset()──▶ Idle        (start() 也会自动重置步骤状态)
```

| 规则 | 说明 |
| :-- | :-- |
| 幂等启动 | `Running` 时再次 `start()` 是 no-op，返回 `Ok(())` |
| 前置校验 (fail-fast) | executor 数量 ≤ 7 且槽位与 `step_index()` 一致；**失败时状态保持不变（不进入 Running）**，返回 `Pipeline` 错误 |
| 取消语义 | `cancel()` 仅在**步边界**生效；进行中的步骤不会被中断；被取消后后续步骤保持 `Pending`，整体为 `Failed` |
| 失败即终止 | 任一步 `Err` → 该步 `Error`，后续步骤不执行，不自动重试 |
| 事件顺序 | `StepStarted(i)` → `StepFinished(i, duration_ms)` 或 `StepFailed(i, message)`；终态事件 `PipelineFinished` / `PipelineFailed` 恰好一次 |

## 2. 步骤契约

| # | id | 输入（读取） | 输出（写入 `Project`） | 异常 → 错误变体 | 降级策略 |
| :-: | :-- | :-- | :-- | :-- | :-- |
| 0 | `intake` | `project.media`（非空，文件存在） | 无（校验） | 无素材 / 文件缺失 → `Project` | 无 |
| 1 | `detect` | 首个媒体文件 | `project.scripts`（按切点划分的分镜骨架） | ffmpeg 不可用不报错 | **降级**为按时长均分的兜底切点 |
| 2 | `script` | 分镜骨架 + LLM 配置 | `project.scripts`（第一人称解说） | 未配置 LLM / 密钥 → `Config`；调用失败 → `Llm` | LLM 输出非 JSON 时**降级**为单段脚本（`warn`） |
| 3 | `voice` | `project.scripts` + TTS 配置 | 各分镜配音音频与总时长 | 未配置 TTS → `Config`；合成失败 → `Tts` | 无 |
| 4 | `subtitle` | 配音结果 | 字幕产物（由导出阶段消费） | — | — |
| 5 | `compose` | 视频 + 配音 | 合成中间产物 | 混流失败**不抛错** | **降级**回退为不混流产物（`warn`） |
| 6 | `export` | 合成产物 + 导出参数 | `project.exports` 追加 `ExportRecord` | ffmpeg 缺失 → `Ffmpeg`；无素材 → `Project` | 无 |

## 3. 错误分类与前端处理

| 变体 | 语义 | 可重试 | 前端建议 |
| :-- | :-- | :-: | :-- |
| `InvalidInput` / `Config` | 用户输入或配置问题 | 否（需用户修正） | 引导到设置页 |
| `Project` | 项目 / 素材状态不满足前置条件 | 否 | 提示重新导入 |
| `Llm` / `Tts` | 外部服务失败 | 是（手动） | 展示 provider 与 message，允许重试 |
| `Ffmpeg` | 本地编码环境问题 | 视情况 | 展示 stderr 末尾 |
| `Pipeline` | 编排层错误（含取消、槽位错配） | 取消可重启 | 展示 message |
| `Io` | 文件 / 网络 | 是 | 展示 message |

## 4. 约定

1. 执行器只通过 `&mut Project` 交换数据，**不得**持有跨步全局状态。
2. 新增步骤必须同时：更新 `STEPS`、`default_executors` 顺序、本文表格、并补一条失败路径单测。
3. 降级行为必须 `tracing::warn!`，且在本文表格登记；静默降级视为缺陷。
