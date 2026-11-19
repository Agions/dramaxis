import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, icon, suffix, className = "", id, disabled, ...props },
  ref,
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-bold text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="pointer-events-none absolute left-3 flex items-center text-[var(--color-text-secondary)]">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] transition-all placeholder:text-[var(--color-text-secondary)]/50 focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-50 ${
            icon ? "pl-9" : ""
          } ${suffix ? "pr-9" : ""} ${
            error
              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/40"
              : ""
          } ${className}`}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 flex items-center text-[var(--color-text-secondary)]">
            {suffix}
          </div>
        )}
      </div>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
});
