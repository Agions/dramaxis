export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = "",
  className = "",
  disabled = false,
}: SliderProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || unit) && (
        <div className="flex items-center justify-between text-xs">
          {label && (
            <span className="font-medium text-[var(--color-text-secondary)]">
              {label}
            </span>
          )}
          <span className="font-mono font-bold text-[var(--color-gold)]">
            {value}
            {unit}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  );
}
