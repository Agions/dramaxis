/**
 * dramaxis v1.3.0 · 设置中心 · 全局与工作台快捷键表 (KeybindingsSection)
 *
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { Card } from "@dramaxis/ui";

export function KeybindingsSection() {
  const SHORTCUTS = [
    { key: "Space", desc: "时间轴播放 / 暂停切换", scope: "制作台 / 监看台" },
    { key: "⌘ / Ctrl + Z", desc: "事务级撤销 (Undo)", scope: "全局" },
    { key: "⇧ + ⌘ / Ctrl + Z", desc: "事务级重做 (Redo)", scope: "全局" },
    {
      key: "⌘ / Ctrl + S",
      desc: "保存当前工程快照至本地 SQLite",
      scope: "全局",
    },
    { key: "⌘ / Ctrl + K", desc: "唤起全局智能命令面板", scope: "全局" },
    { key: "← / →", desc: "时间轴微调步进 0.2 秒", scope: "制作台" },
    { key: "Shift + ← / →", desc: "时间轴快进/快退 1.0 秒", scope: "制作台" },
    { key: "Home / End", desc: "直接定位到时间轴头/尾", scope: "制作台" },
    { key: "I", desc: "设定选区入点 (Mark In)", scope: "制作台" },
    { key: "O", desc: "设定选区出点 (Mark Out)", scope: "制作台" },
    {
      key: "Esc",
      desc: "清除 Mark 选区 / 取消片段选中 / 关闭模态弹窗",
      scope: "全局",
    },
    { key: "M", desc: "静音/显示所选轨道", scope: "制作台" },
    { key: "S", desc: "独奏/独显所选轨道", scope: "制作台" },
    { key: "L", desc: "锁定/解锁轨道", scope: "制作台" },
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
