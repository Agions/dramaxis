/**
 * splicr v1.0.1 · 设置与模型引擎中心 (深度模块化与组件化架构)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { settingsIpc, type ConfigSnapshot } from "@dramaxis/ipc";
import { useSettingsStore, t } from "@dramaxis/core";
import { Tabs } from "@dramaxis/ui";
import { toast } from "sonner";
import { LlmProvidersSection } from "../components/settings/LlmProvidersSection";
import { TtsVoicesSection } from "../components/settings/TtsVoicesSection";
import { EnvironmentSection } from "../components/settings/EnvironmentSection";
import { KeybindingsSection } from "../components/settings/KeybindingsSection";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const DEFAULT_SNAPSHOT: ConfigSnapshot = {
  theme: "dark",
  language: "zh-CN",
  llm_provider: "open-ai",
  auto_update: true,
  first_run: true,
  llm_api_key: null,
  llm_base_url: null,
  llm_model: null,
  tts_provider: "edge",
  tts_api_key: null,
  tts_base_url: null,
  tts_voice: null,
  tts_ref_audio_path: null,
  tts_prompt_text: null,
};

function SettingsPage() {
  const qc = useQueryClient();
  const locale = useSettingsStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<string>("llm");
  const [form, setForm] = useState<ConfigSnapshot>(DEFAULT_SNAPSHOT);

  const { data: snapshot } = useQuery({
    queryKey: ["settings-snapshot"],
    queryFn: () => settingsIpc.get(),
  });

  useEffect(() => {
    if (snapshot) {
      setForm(snapshot);
      useSettingsStore.getState().syncFromSnapshot(snapshot);
    }
  }, [snapshot]);

  const saveMutation = useMutation({
    mutationFn: (snap: ConfigSnapshot) => settingsIpc.set(snap),
    onSuccess: (_, variables) => {
      useSettingsStore.getState().syncFromSnapshot(variables);
      void qc.invalidateQueries({ queryKey: ["settings-snapshot"] });
      void qc.invalidateQueries({ queryKey: ["app-config-settings"] });
      toast.success(t("settings.saved", locale) || "设置保存成功");
    },
    onError: (e) => {
      toast.error(t("settings.save_failed", locale) || "保存设置失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const TAB_ITEMS = [
    { id: "llm", label: "大语言模型", icon: "🤖", badge: "10" },
    { id: "tts", label: "TTS 配音引擎", icon: "🎙️", badge: "4" },
    { id: "env", label: "系统与硬件加速", icon: "⚡" },
    { id: "keys", label: "快捷键字典", icon: "⌨️" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-bg p-6 md:p-8 select-none font-sans">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 顶部标题与保存按钮 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-text-primary">
              全局设置与引擎配置
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              管理 10 大 LLM 大模型、48kHz 配音合成、GPU 硬件加速与快捷键
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold to-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 shadow-[0_0_20px_var(--color-gold-glow)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {saveMutation.isPending ? "正在保存..." : "💾 保存全局配置"}
          </button>
        </div>

        {/* 导航 Tabs */}
        <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={setActiveTab} />

        {/* Tab 内容区 */}
        <div className="pt-2">
          {activeTab === "llm" && (
            <LlmProvidersSection form={form} setForm={setForm} />
          )}
          {activeTab === "tts" && (
            <TtsVoicesSection form={form} setForm={setForm} />
          )}
          {activeTab === "env" && (
            <EnvironmentSection form={form} setForm={setForm} />
          )}
          {activeTab === "keys" && <KeybindingsSection />}
        </div>
      </div>
    </div>
  );
}
