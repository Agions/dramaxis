import type { HTMLAttributes, ReactNode } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "gold" | "red" | "emerald" | "blue" | "zinc";
  size?: "sm" | "md";
  children: ReactNode;
}

export function Badge({
  variant = "zinc",
  size = "sm",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    gold: "bg-[var(--color-gold-muted)] border-[var(--color-gold)] text-[var(--color-gold)] shadow-[0_0_8px_var(--color-gold-glow)]",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    zinc: "bg-zinc-800/80 border-zinc-700 text-zinc-300",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-tight transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
