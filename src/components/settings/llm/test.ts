/**
 * dramaxis v1.2.0 · useLlmConnectionTest
 *
 * LLM 连通性测试与延迟探测领域 Hook
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { settingsIpc, type LlmTestResult } from "@dramaxis/ipc";

export function useLlmConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

  const testConnection = useCallback(
    async (params: {
      provider: string;
      apiKey?: string | null;
      model?: string | null;
      baseUrl?: string | null;
      providerName: string;
    }) => {
      const { provider, apiKey, model, baseUrl, providerName } = params;
      if (!apiKey && provider !== "local") {
        toast.error("请先填写 API Key 后再测试连通性");
        return;
      }
      setTesting(true);
      setTestResult(null);
      const toastId = toast.loading(`正在测试与 ${providerName} 的连通性...`);
      try {
        const res = await settingsIpc.testLlm({
          provider,
          apiKey: apiKey || "no-key-required",
          model: model || "default",
          baseUrl: baseUrl || null,
        });
        setTestResult(res);
        if (res.success) {
          toast.success(`✓ ${providerName} 连通正常 (${res.latencyMs}ms)`, {
            id: toastId,
          });
        } else {
          toast.error(`连通失败: ${res.message}`, { id: toastId });
        }
      } catch (err: unknown) {
        toast.error(
          `连通异常: ${err instanceof Error ? err.message : String(err)}`,
          { id: toastId },
        );
      } finally {
        setTesting(false);
      }
    },
    [],
  );

  return {
    testing,
    testResult,
    testConnection,
  };
}
