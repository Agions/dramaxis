import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  interactive?: boolean;
  children: ReactNode;
}

export function Card({
  glow = false,
  interactive = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200 ${
        glow
          ? "shadow-[0_0_24px_var(--color-gold-glow)] border-[var(--color-gold)]/40"
          : "shadow-sm"
      } ${
        interactive
          ? "cursor-pointer hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-surface-elevated)] hover:translate-y-[-1px] active:translate-y-[0px]"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
