export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className = "" }: TabsProps) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 ${className}`}
      role="tablist"
    >
      {items.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 ${
              active
                ? "bg-[var(--color-gold-muted)] text-[var(--color-gold)] shadow-[0_0_12px_var(--color-gold-glow)] border border-[var(--color-gold)]/40"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="rounded-full bg-[var(--color-gold)] px-1.5 py-0.2 text-[9px] font-black text-zinc-950">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
