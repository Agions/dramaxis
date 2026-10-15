import { Card } from "@dramaxis/ui";

export function KeybindingsSection() {
  const SHORTCUTS = [
    { key: "Space", desc: "时间轴播放 / 暂停切换", scope: "全局 / 制作台" },
    {
      key: "⌘ / Ctrl + S",
      desc: "保存当前工程快照至本地 SQLite",
      scope: "全局",
    },
    { key: "⌘ / Ctrl + K", desc: "唤起全局智能命令面板", scope: "全局" },
    { key: "← / →", desc: "时间轴前后步进 1 帧", scope: "制作台" },
    { key: "Shift + ← / →", desc: "时间轴快速跳转 1 秒", scope: "制作台" },
    {
      key: "Delete / Backspace",
      desc: "删除当前选中的时间轴片段",
      scope: "制作台",
    },
    { key: "Esc", desc: "关闭当前打开的模态弹窗或退出全屏", scope: "全局" },
  ];

  return (
    <Card className="space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-bold text-text-primary">
          全局生产力快捷键字典
        </h3>
        <p className="text-[11px] text-text-secondary">
          提高剪辑推演与调色台操作效率的原生快捷键映射
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SHORTCUTS.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-3"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-text-primary">
                {item.desc}
              </div>
              <div className="text-[10px] text-text-secondary">
                {item.scope}
              </div>
            </div>
            <kbd className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs font-bold text-gold shadow-inner">
              {item.key}
            </kbd>
          </div>
        ))}
      </div>
    </Card>
  );
}
