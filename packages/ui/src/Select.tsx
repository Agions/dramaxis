import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, children, className = "", id, disabled, ...props },
  ref,
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-bold text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 pr-8 text-xs font-medium text-[var(--color-text-primary)] transition-all focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-50 ${
            error
              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/40"
              : ""
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
});
