import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div
        className={`relative z-10 w-full ${maxWidthClass} rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-all`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between border-b border-[var(--color-border)] p-5">
            <div>
              {title && (
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
              aria-label="关闭"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
