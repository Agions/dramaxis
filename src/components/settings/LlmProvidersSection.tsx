/**
 * dramaxis v1.2.0 · LlmProvidersSection
 *
 * 设置中心 · 大语言模型配置总控区 (分层模块化架构)
 */

import { memo, useCallback } from "react";
import type { ConfigSnapshot } from "@dramaxis/ipc";
import { LLM_OPTIONS, type LlmMeta } from "./llm/llmOptions";
import { useLlmConnectionTest } from "./llm/useLlmConnectionTest";
import { LlmProviderGrid } from "./llm/LlmProviderGrid";
import { LlmConfigForm } from "./llm/LlmConfigForm";
import { AgentModelMatrixCard } from "./llm/AgentModelMatrixCard";

// 重新导出以便消费方保持 100% 类型与常量向后兼容
export { LLM_OPTIONS, type LlmMeta };

export interface LlmProvidersSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export const LlmProvidersSection = memo(function LlmProvidersSection({
  form,
  setForm,
}: LlmProvidersSectionProps) {
  const { testing, testResult, testConnection } = useLlmConnectionTest();

  const currentLlm =
    LLM_OPTIONS.find((o) => o.id === form.llm_provider) ?? LLM_OPTIONS[0]!;

  const handleSelectProvider = useCallback(
    (item: LlmMeta) => {
      setForm((prev) => ({
        ...prev,
        llm_provider: item.id,
        llm_model:
          prev.llm_provider === item.id ? prev.llm_model : item.defaultModel,
      }));
    },
    [setForm],
  );

  const handleTest = useCallback(() => {
    void testConnection({
      provider: form.llm_provider,
      apiKey: form.llm_api_key,
      model: form.llm_model || currentLlm.defaultModel,
      baseUrl: form.llm_base_url,
      providerName: currentLlm.name,
    });
  }, [testConnection, form, currentLlm]);

  return (
    <div className="space-y-6">
      {/* 1. 厂商卡片矩阵选择器 */}
      <LlmProviderGrid
        selectedProvider={form.llm_provider}
        onSelect={handleSelectProvider}
      />

      {/* 2. 当前选中厂商参数与连通测试卡片 */}
      <LlmConfigForm
        currentLlm={currentLlm}
        form={form}
        setForm={setForm}
        testing={testing}
        testResult={testResult}
        onTestConnection={handleTest}
      />

      {/* 3. 异构智能体专精模型矩阵卡片 */}
      <AgentModelMatrixCard form={form} setForm={setForm} />
    </div>
  );
});
