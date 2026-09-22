import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigSnapshot } from "@splicr/ipc";
import { Badge, Card, Switch } from "@splicr/ui";
import { useSettingsStore, useThemeStore, type Theme } from "@splicr/core";

interface EnvironmentSectionProps {
  form: ConfigSnapshot;
  setForm: React.Dispatch<React.SetStateAction<ConfigSnapshot>>;
}

export function EnvironmentSection({ form, setForm }: EnvironmentSectionProps) {
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // 探测系统支持的硬件加速编解码器
  const { data: hwAccelerators } = useQuery<string[]>({
    queryKey: ["hardware-acceleration-probe"],
    queryFn: async () => {
      try {
        return await invoke<string[]>("detect_hardware_acceleration");
      } catch {
        return ["none"];
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* 调色台外观与语言 */}
      <Card className="space-y-5">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text-primary">
            视觉系统与界面语言
          </h3>
          <p className="text-[11px] text-text-secondary">
            自定义调色台沉浸式工作环境与本地化体验
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* 主题选择 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">
              工作台外观主题
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "dark", label: "暗黑调色台", icon: "🌙" },
                { id: "light", label: "明亮影棚", icon: "☀️" },
                { id: "system", label: "跟随系统", icon: "💻" },
              ].map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setTheme(th.id as Theme)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition ${
                    currentTheme === th.id
                      ? "border-gold bg-gold-muted text-gold"
                      : "border-border bg-surface-elevated text-text-secondary hover:border-zinc-700"
                  }`}
                >
                  <span className="text-base">{th.icon}</span>
                  <span>{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 语言选择 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">
              语言首选项 (Language)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "zh-CN", label: "简体中文", flag: "🇨🇳" },
                { id: "en-US", label: "English", flag: "🇺🇸" },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLocale(lang.id as "zh-CN" | "en-US")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    locale === lang.id
                      ? "border-gold bg-gold-muted text-gold"
                      : "border-border bg-surface-elevated text-text-secondary hover:border-zinc-700"
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 底层引擎与 GPU 硬件加速 */}
      <Card className="space-y-4">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text-primary">
            底层运行时与硬件加速
          </h3>
          <p className="text-[11px] text-text-secondary">
            音视频高性能编解码状态与自动更新配置
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-3.5">
          <div className="space-y-1">
            <div className="text-xs font-bold text-text-primary">
              GPU 硬件加速编解码器 (Auto Hardware Acceleration)
            </div>
            <div className="text-[11px] text-text-secondary">
              当前系统可用加速模块：
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hwAccelerators && hwAccelerators.length > 0 ? (
              hwAccelerators.map((hw) => (
                <Badge key={hw} variant="emerald" size="md">
                  ⚡ {hw.toUpperCase()}
                </Badge>
              ))
            ) : (
              <Badge variant="zinc">探测中...</Badge>
            )}
          </div>
        </div>

        <Switch
          label="启动时静默检查客户端新版本"
          description="当发现重大更新时自动在侧边栏呈现提示徽标"
          checked={form.auto_update}
          onChange={(checked) =>
            setForm((prev) => ({ ...prev, auto_update: checked }))
          }
        />
      </Card>
    </div>
  );
}
