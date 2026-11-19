import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 ${className}`}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-gold-muted)] text-xl text-[var(--color-gold)]">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
        {title}
      </h4>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-[var(--color-text-secondary)] leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
