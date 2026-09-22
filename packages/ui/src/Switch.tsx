export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  className = "",
}: SwitchProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-xs font-bold text-[var(--color-text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-[var(--color-gold)]" : "bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4 bg-zinc-950" : "translate-x-0 bg-zinc-300"
          }`}
        />
      </button>
    </div>
  );
}
