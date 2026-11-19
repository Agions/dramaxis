import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    className = "",
    disabled,
    children,
    ...props
  },
  ref,
) {
  const baseClasses =
    "inline-flex items-center justify-center font-bold transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const sizeClasses = {
    xs: "px-2 py-1 text-[11px] rounded-lg gap-1.5",
    sm: "px-3 py-1.5 text-xs rounded-xl gap-2",
    md: "px-4 py-2 text-xs rounded-xl gap-2",
    lg: "px-5 py-2.5 text-sm rounded-2xl gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-[var(--color-gold)] text-black shadow-sm hover:brightness-110 active:brightness-95 active:scale-[0.99]",
    secondary:
      "bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-surface-elevated)]/80 active:scale-[0.99]",
    outline:
      "bg-transparent border border-[var(--color-gold)] text-[var(--color-gold)] hover:bg-[var(--color-gold-muted)] active:scale-[0.99]",
    ghost:
      "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] active:scale-[0.99]",
    danger:
      "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-[0.99]",
  }[variant];

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="h-3.5 w-3.5 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
