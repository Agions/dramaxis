# splicr-script · 11 大主流 LLM 矩阵适配引擎

`splicr-script` 负责与行业顶级大模型通信，统一请求协议、分段剧本 Prompt 模版渲染与流式响应解析。

---

## 1. 支持的大模型矩阵

| 厂商 / 服务商         | 支持的模型系列                                 | 推荐适用场景                         |
| :-------------------- | :--------------------------------------------- | :----------------------------------- |
| **Anthropic**         | `claude-3-7-sonnet`, `claude-3-5-haiku`        | 情绪饱满、文学修辞丰富的高质解说脚本 |
| **DeepSeek**          | `deepseek-chat (V3)`, `deepseek-reasoner (R1)` | 剧情逻辑深度推演、高性价比分段解说   |
| **OpenAI**            | `gpt-4o`, `gpt-4o-mini`, `o3-mini`             | 多模态画面理解与紧凑节奏短视频脚本   |
| **Aliyun (通义千问)** | `qwen-max`, `qwen-plus`, `qwen-turbo`          | 国内低延迟高稳定性影视解说           |
| **Google**            | `gemini-2.0-flash`, `gemini-2.0-pro`           | 超长上下文剧情大纲归纳               |
| **Zhipu (智谱)**      | `glm-4-plus`, `glm-4-flash`                    | 本土化影视黑话与网络流行梗生成       |

---

## 2. 统一 Provider 抽象 Trait

```rust
#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn generate_script(
        &self,
        params: &ScriptGenerateParams,
    ) -> Result<ScriptGenerateResult, SplicrError>;
}
```
