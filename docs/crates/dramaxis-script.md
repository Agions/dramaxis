# dramaxis-script · 11 大主流 LLM 网关与创作飞轮引擎

`dramaxis-script` 是影视剧本创作与叙事理解的核心算子库。它不仅统一封装了国内外 11 家主流商业与开源大语言模型的通信协议，更内建了面向短剧高完播率的 **爆款飞轮引擎 (`ScriptFlywheelEngine`)** 与 **黄金 3 秒 Hook 公式库 (`HookEngine`)**。

---

## 1. 11 大主流 LLM 矩阵与协议适配

引擎内部将 9 家兼容 OpenAI 规范的厂商抽象为高性能底层 `OpenAiCompatible`，并将 Anthropic Claude 与 Google Gemini 各自实现为原生二进制请求客户端：

| 厂商分类 | 支持的服务商与代表模型 | 内部驱动协议 | 典型短剧创作场景 |
| :--- | :--- | :--- | :--- |
| **阿里旗舰** | 通义千问 (`qwen3.8-max`, `qwen3.7-plus`, `qwen3.8-omni-flash`) | OpenAI 兼容 | 影视原生看图分镜、超大规模基座与深度推理反转 |
| **深度推理** | DeepSeek (`deepseek-v4-pro`, `deepseek-flash`, `deepseek-chat`) | OpenAI 兼容 | 复杂多线剧情伏笔拆解、长篇原著脉络深度反转 |
| **国际标杆** | OpenAI (`gpt-5`, `o3-mini`, `o3`, `gpt-4.5-preview`, `gpt-4o`) | OpenAI 原生 | 电影级第一人称叙事、细腻心理独白与高级思维链推理 |
| **文学大师** | Anthropic (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-2`) | Claude Messages 原生 | 意象化文学修辞手法、自适应混合思考与深度影评 |
| **超长感官** | Google (`gemini-3.8-flash`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`) | Gemini GenAI 原生 | 原生百万帧超长剧集连续梗概、多模态关键帧全景联想 |
| **长篇拆条** | Moonshot Kimi (`kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `kimi-k3`) | OpenAI 兼容 | 3万亿参数原生视觉理解、百万字剧本结构化拆条与人物索引 |
| **清华开源** | 智谱 GLM (`glm-5.3`, `glm-5.3-flash`, `glm-5.2`, `glm-5v`) | OpenAI 兼容 | 综合基座旗舰协同创作、多模态视频分析与本土化台词精修 |
| **短剧生态** | 字节豆包 (`doubao-seed-2-1-pro-260915`, `doubao-seed-evolving`) | OpenAI 兼容 | 抖音/快手短平快高冲突节奏、火山方舟视听多模态短剧 |
| **腾讯旗舰** | 腾讯混元 (`hy4`, `hy4-preview`, `hy3`, `hunyuan-a13b`) | OpenAI 兼容 | 腾讯 TokenHub 主力旗舰、原生视觉理解与多视角剧情编排 |
| **私有离线** | 本地 Ollama / LMStudio (`deepseek-r1:14b`, `qwq:32b`, `qwen3:14b`, `llama3.3:70b`) | 本地 OpenAI 兼容 | 绝密版权素材零外泄离线创作、本地私有化高算力部署 |
| **前沿探索** | Qwen 实验版 (`qwen3.8-omni-flash`) | 实验端点 | 前沿全模态视听流算子与快速原型评测 |

---

## 2. 统一 Provider 抽象与多模态扩展

```rust
use async_trait::async_trait;
use dramaxis_core::error::{LlmProviderKind, DramaxisResult};

#[derive(Debug, Clone, Default)]
pub struct LlmRequest {
    pub system: String,
    pub user: String,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub stream: bool,
    /// 视觉分析师抽取的多模态高能关键帧 Base64 列表
    pub images_base64: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct LlmResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: u32,
    pub duration_ms: u64,
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    fn kind(&self) -> LlmProviderKind;
    fn default_model(&self) -> &'static str;
    async fn chat(&self, req: &LlmRequest) -> DramaxisResult<LlmResponse>;
}
```

---

## 3. 创作飞轮与黄金 Hook 算子 (`flywheel.rs`)

`dramaxis-script` 内建了工业级创作飞轮算法：

1. **爆款样本风格解构 (`deconstruct_reference_script`)**：
   通过词频密度、句长方差与情绪转折点打分，逆向提取参考剧本的叙事节奏参数（如每秒字数密度、转折频率、疑问句占比）。
2. **黄金 3 秒 Hook 公式矩阵 (`HookEngine`)**：
   针对前 3 秒留存率进行专项公式注入，涵盖：
   - **结果前置反转型 (Reverse Hook)**：先展示极端结局，再回溯诱因；
   - **认知失调悬念型 (Cognitive Conflict)**：挑战常识认知的强烈冲突对立；
   - **第一人称共情型 (Direct Identity)**：瞬间拉近与观众心理距离的情绪独白。
3. **留存张力曲线预测 (`calculate_retention_arc`)**：
   在送往配音前，按分镜片段估算留存拉力值（Retention Score），形成波峰波谷曲线上报给终审质量守门员。
