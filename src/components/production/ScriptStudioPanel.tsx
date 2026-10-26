/**
 * dramaxis v1.1.0 · ScriptStudioPanel · AI 独白与剧本创作工坊
 *
 * 核心功能:
 * - 11 大主流 LLM 大模型选择 (Qwen 3.8 / GPT-5.6 / DeepSeek V4...)
 * - 4 种第一人称叙事风格 (沉浸 / 深度解析 / 悬疑反转 / 幽默吐槽)
 * - 提示词与剧情脉络输入
 * - 流式文案编辑与一键复制
 * - 自反思评分回路
 */

import { memo, useState } from "react";
import { toast } from "sonner";
import {
  scriptIpc,
  settingsIpc,
  type HookCandidate,
  type StyleProfile,
  type RetentionTensionArc,
} from "@dramaxis/ipc";

interface ScriptStudioPanelProps {
  llmProvider: string;
  onLlmProviderChange: (val: string) => void;
  scriptStyle: "immersive" | "critic" | "story" | "roast";
  onScriptStyleChange: (
    val: "immersive" | "critic" | "story" | "roast",
  ) => void;
  userPrompt: string;
  onUserPromptChange: (val: string) => void;
  scriptText: string;
  onScriptTextChange: (val: string) => void;
  isGeneratingScript: boolean;
  onGenerateScript: () => void;
}

export const ScriptStudioPanel = memo(function ScriptStudioPanel({
  llmProvider,
  onLlmProviderChange,
  scriptStyle,
  onScriptStyleChange,
  userPrompt,
  onUserPromptChange,
  scriptText,
  onScriptTextChange,
  isGeneratingScript,
  onGenerateScript,
}: ScriptStudioPanelProps) {
  const [hooks, setHooks] = useState<HookCandidate[]>([]);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [selectedHookIndex, setSelectedHookIndex] = useState<number | null>(
    null,
  );

  // 1. Few-Shot 对标爆款解构状态
  const [showDeconstruct, setShowDeconstruct] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [isDeconstructing, setIsDeconstructing] = useState(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);

  // 2. 留存张力波形分析状态
  const [retentionArc, setRetentionArc] = useState<RetentionTensionArc | null>(
    null,
  );
  const [isAnalyzingArc, setIsAnalyzingArc] = useState(false);

  // 3. 模型连通性快速测速
  const [testingModel, setTestingModel] = useState(false);
  const [modelLatency, setModelLatency] = useState<number | null>(null);

  const handleQuickTest = async () => {
    setTestingModel(true);
    try {
      const cfg = await settingsIpc.get();
      const res = await settingsIpc.testLlm({
        provider: llmProvider,
        apiKey: cfg.llm_api_key || "no-key-required",
        model: cfg.llm_model,
        baseUrl: cfg.llm_base_url,
      });
      if (res.success) {
        setModelLatency(res.latencyMs);
        toast.success(`✓ ${llmProvider} 连通正常 (${res.latencyMs}ms)`);
      } else {
        setModelLatency(null);
        toast.error(`连通失败: ${res.message}，请在「设置」中检查 API Key`);
      }
    } catch (e: any) {
      toast.error(`测试异常: ${e?.message || String(e)}`);
    } finally {
      setTestingModel(false);
    }
  };

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    try {
      const candidates = await scriptIpc.generateHooks(
        userPrompt || "这个故事",
      );
      setHooks(candidates);
      setSelectedHookIndex(null);
      toast.success("成功生成 4 大公式爆款 Hook (0~3s 黄金留存)");
    } catch (e) {
      toast.error(`生成 Hook 失败: ${String(e)}`);
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleApplyHook = (hook: HookCandidate, index: number) => {
    setSelectedHookIndex(index);
    const trimmed = scriptText.trim();
    if (!trimmed) {
      onScriptTextChange(hook.hookText + "\n\n");
    } else {
      // 若已有文案，将黄金 Hook 作为首句置顶插入
      onScriptTextChange(`${hook.hookText}\n\n${trimmed}`);
    }
    toast.success(`已采纳【${hook.formulaName}】为黄金 3 秒开场！`);
  };

  // 解构对标参考爆款
  const handleDeconstruct = async () => {
    if (!referenceText.trim()) {
      toast.warning("请输入对标爆款剧本文案");
      return;
    }
    setIsDeconstructing(true);
    try {
      const profile = await scriptIpc.deconstructReference(referenceText);
      setStyleProfile(profile);
      toast.success(`爆款风格画像解构成功：${profile.titleOrGenre}`);
    } catch (e) {
      toast.error(`解构失败: ${String(e)}`);
    } finally {
      setIsDeconstructing(false);
    }
  };

  // 将解构出的 Few-Shot 指导注入提示词
  const handleApplyStyleToPrompt = () => {
    if (!styleProfile) return;
    const addition = `\n\n【对标爆款风格画像】\n流派：${styleProfile.titleOrGenre}\n特征：${styleProfile.formulaSummary}\n指导：${styleProfile.fewShotPrompt}`;
    onUserPromptChange((userPrompt + addition).trim());
    toast.success("已将对标爆款画像注入提示词输入框！");
  };

  // 计算留存张力曲线
  const handleCalculateRetentionArc = async () => {
    if (!scriptText.trim()) {
      toast.warning("文案为空，无法计算留存曲线");
      return;
    }
    setIsAnalyzingArc(true);
    try {
      const arc = await scriptIpc.calculateRetentionArc(scriptText, 60.0);
      setRetentionArc(arc);
      toast.success(
        `留存曲线计算完成！综合留存指数: ${arc.overallRetentionIndex.toFixed(1)}%`,
      );
    } catch (e) {
      toast.error(`计算留存曲线失败: ${String(e)}`);
    } finally {
      setIsAnalyzingArc(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-text-secondary">
            大模型选择
          </label>
          <div className="flex items-center gap-1.5">
            {modelLatency !== null && (
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {modelLatency}ms
              </span>
            )}
            <button
              type="button"
              disabled={testingModel}
              onClick={handleQuickTest}
              className="text-[11px] font-bold text-gold hover:text-gold-hover transition-colors disabled:opacity-50"
            >
              {testingModel ? "测速中..." : "⚡ 测速"}
            </button>
          </div>
        </div>
        <select
          value={llmProvider}
          onChange={(e) => onLlmProviderChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-gold"
        >
          <option value="qwen">通义千问 (qwen-plus 推荐)</option>
          <option value="deepseek">DeepSeek (deepseek-chat / R1)</option>
          <option value="open-ai">OpenAI (gpt-4o)</option>
          <option value="claude">Claude (claude-sonnet-4)</option>
          <option value="gemini">Gemini (gemini-2.5-flash)</option>
          <option value="kimi">Kimi · 月之暗面 (moonshot-v1)</option>
          <option value="glm5">智谱 GLM (glm-4-flash)</option>
          <option value="doubao">豆包 Doubao (doubao-pro)</option>
          <option value="hunyuan">腾讯混元 (hunyuan-standard)</option>
          <option value="local">本地 Ollama (llama3.2)</option>
          <option value="custom">⚙️ 自定义模型 (OpenAI兼容/中转)</option>
        </select>
        {llmProvider === "custom" && (
          <div className="rounded-lg bg-surface-muted border border-border/80 p-2 text-[11px] text-text-secondary flex items-center justify-between">
            <span>⚙️ 自定义 OpenAI 兼容端点：将在「设置」中读取自定义 Base URL 与模型名称</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          解说风格
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "immersive" as const, label: "第一人称沉浸" },
            { id: "critic" as const, label: "影视深度解析" },
            { id: "story" as const, label: "悬疑反转故事" },
            { id: "roast" as const, label: "幽默风趣吐槽" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScriptStyleChange(s.id)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${
                scriptStyle === s.id
                  ? "border-gold bg-gold-muted text-gold font-bold shadow-sm"
                  : "border-border bg-bg text-text-secondary hover:text-text-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-text-secondary">
            提示词 / 剧情脉络
          </label>
          <button
            type="button"
            onClick={() => setShowDeconstruct(!showDeconstruct)}
            className="text-[10px] text-gold hover:underline font-medium"
          >
            {showDeconstruct ? "收起对标解构 ▲" : "🔍 对标爆款 Few-Shot 解构 ▼"}
          </button>
        </div>
        <input
          type="text"
          value={userPrompt}
          onChange={(e) => onUserPromptChange(e.target.value)}
          placeholder="输入剧本核心梗概、情感走向..."
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-primary outline-none focus:border-gold"
        />

        {/* Few-Shot 对标爆款文案解构器 */}
        {showDeconstruct && (
          <div className="rounded-xl border border-gold/40 bg-surface/70 p-3 space-y-2 mt-1.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gold flex items-center gap-1">
                <span>🎯</span> 爆款参考文案解构
              </span>
              <button
                type="button"
                onClick={handleDeconstruct}
                disabled={isDeconstructing}
                className="px-2 py-0.5 rounded bg-gold text-zinc-950 font-bold text-[10px] hover:brightness-110 disabled:opacity-50"
              >
                {isDeconstructing ? "解构中..." : "⚡ 一键解构画像"}
              </button>
            </div>
            <textarea
              rows={3}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="在此粘贴同赛道爆款解说词片段（自动提取均句长、网感词与情绪走向）..."
              className="w-full rounded-lg border border-border bg-bg p-2 text-[11px] text-text-primary outline-none focus:border-gold resize-none"
            />
            {styleProfile && (
              <div className="rounded-lg border border-border/80 bg-bg/80 p-2.5 space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">
                    画像: {styleProfile.titleOrGenre}
                  </span>
                  <span className="font-mono text-gold font-bold">
                    均句长: {styleProfile.avgSentenceLength}字 · 语速:{" "}
                    {styleProfile.estimatedWpm}字/分
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-text-muted">爆款热词:</span>
                  {styleProfile.viralKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className="text-text-secondary truncate max-w-[200px]">
                    {styleProfile.formulaSummary}
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyStyleToPrompt}
                    className="text-gold font-bold hover:underline"
                  >
                    + 注入提示词
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 黄金 3 秒爆款 Hook 开场公式引擎 */}
      <div className="rounded-xl border border-border bg-bg/80 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary">
              🎯 黄金 3 秒爆款 Hook 引擎
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
              0~3s 留存率倍增
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerateHooks}
            disabled={isGeneratingHooks}
            className="text-[10px] font-bold text-gold hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            {isGeneratingHooks ? "⚡ 计算中..." : "⚡ 一键推导 4 大公式"}
          </button>
        </div>

        {hooks.length > 0 ? (
          <div className="space-y-2">
            {hooks.map((h, idx) => {
              const isSelected = selectedHookIndex === idx;
              const badgeColor =
                h.formula === "result_first"
                  ? "text-red-400 border-red-500/30 bg-red-500/10"
                  : h.formula === "counter_intuitive"
                    ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                    : h.formula === "high_stakes_empathy"
                      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                      : "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";

              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-2.5 text-xs transition-all ${
                    isSelected
                      ? "border-gold bg-gold/10 shadow-sm"
                      : "border-border bg-surface hover:border-gold/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}
                    >
                      {h.formulaName}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-gold">
                      {h.estimatedRetentionScore}% 预估留存
                    </span>
                  </div>
                  <p className="text-[11px] text-text-primary leading-relaxed font-medium mb-2">
                    "{h.hookText}"
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span className="truncate max-w-[220px]">
                      💡 {h.strategyReason}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyHook(h, idx)}
                      className="px-2 py-0.5 rounded bg-gold/20 hover:bg-gold/30 text-gold font-bold text-[10px] transition-colors"
                    >
                      {isSelected ? "✓ 已采纳" : "采纳开场"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-surface/40 p-3 text-center">
            <p className="text-[11px] text-text-secondary mb-1">
              短视频算法完播率关键在于前 3 秒！
            </p>
            <p className="text-[10px] text-text-muted">
              点击上方「⚡ 一键推导 4
              大公式」基于梗概实时计算高潮前置、认知颠覆、生存危机与强悬念候选。
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-text-secondary">
            解说文案编辑
          </label>
          {scriptText && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(scriptText);
                toast.success("文案已复制到剪贴板");
              }}
              className="text-[10px] text-gold hover:underline"
            >
              📋 复制
            </button>
          )}
        </div>
        <textarea
          value={scriptText}
          onChange={(e) => onScriptTextChange(e.target.value)}
          rows={8}
          placeholder="等待 AI 智能体生成或直接在此输入/编辑解说词..."
          className="w-full rounded-xl border border-border bg-bg p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-gold font-sans"
        />

        {/* 留存曲线张力引擎 (Retention Tension Arc) */}
        <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <span>📈</span> 留存曲线张力分析 (Retention Arc)
            </span>
            <button
              type="button"
              onClick={handleCalculateRetentionArc}
              disabled={isAnalyzingArc || !scriptText.trim()}
              className="text-[10px] font-bold text-gold hover:underline disabled:opacity-50"
            >
              {isAnalyzingArc ? "⏳ 计算中..." : "⚡ 测评留存波形"}
            </button>
          </div>

          {retentionArc ? (
            <div className="space-y-2.5">
              {/* 四维留存评分指标 */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5">
                  <div className="text-[9px] text-text-muted">0~3s Hook</div>
                  <div className="font-mono text-xs font-bold text-red-400">
                    {retentionArc.hookScore.toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-1.5">
                  <div className="text-[9px] text-text-muted">3~15s 代入</div>
                  <div className="font-mono text-xs font-bold text-amber-400">
                    {retentionArc.setupEmpathyScore.toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-1.5">
                  <div className="text-[9px] text-text-muted">15~45s 高潮</div>
                  <div className="font-mono text-xs font-bold text-purple-400">
                    {retentionArc.climaxIntensity.toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-1.5">
                  <div className="text-[9px] text-text-muted">45s+ 悬念</div>
                  <div className="font-mono text-xs font-bold text-cyan-400">
                    {retentionArc.cliffhangerRetention.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* 留存波形曲线 (SVG 动态渲染) */}
              <div className="relative h-16 w-full rounded-lg bg-bg border border-border/80 px-2 py-1 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[8px] font-mono text-text-muted">
                  <span>开篇 Hook</span>
                  <span>痛点展开</span>
                  <span>冲突爆发</span>
                  <span>反转悬念</span>
                </div>
                <svg
                  className="w-full h-8 overflow-visible"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 40"
                >
                  <defs>
                    <linearGradient
                      id="arcGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="25%" stopColor="#f59e0b" />
                      <stop offset="70%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  {/* 折线图路径 */}
                  <polyline
                    fill="none"
                    stroke="url(#arcGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={retentionArc.curvePoints
                      .map((pt, i, arr) => {
                        const x = (i / Math.max(1, arr.length - 1)) * 100;
                        const y = 40 - (pt.tensionLevel / 100) * 36;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(" ")}
                  />
                  {retentionArc.curvePoints.map((pt, i, arr) => {
                    const x = (i / Math.max(1, arr.length - 1)) * 100;
                    const y = 40 - (pt.tensionLevel / 100) * 36;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="2.5"
                        fill="#fbbf24"
                        stroke="#09090b"
                        strokeWidth="1"
                      />
                    );
                  })}
                </svg>
                <div className="flex justify-between items-center text-[9px]">
                  <span className="font-bold text-text-secondary">
                    综合爆款留存指数:
                  </span>
                  <span className="font-mono font-bold text-gold">
                    {retentionArc.overallRetentionIndex.toFixed(1)}% 完播可能
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-text-muted text-center py-1">
              生成或输入文案后，点击右上角「⚡ 测评留存波形」评估完播留存张力。
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerateScript}
        disabled={isGeneratingScript}
        className="w-full rounded-xl bg-gradient-to-r from-gold to-amber py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_16px_var(--color-gold-glow)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
      >
        {isGeneratingScript
          ? "🤖 AI 正在生成独白剧本..."
          : "⚡ 重新生成 AI 剧本"}
      </button>
    </div>
  );
});
