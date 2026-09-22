import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[splicr ErrorBoundary caught error]:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-3xl border border-red-500/30 bg-red-500/5 p-8 text-center backdrop-blur-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-2xl text-red-400">
            ⚠
          </div>
          <h3 className="mt-4 text-base font-extrabold text-red-200">
            组件运行时发生异常
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-red-300/80 font-mono">
            {this.state.error.message || "未知错误"}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-5 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/30 active:scale-95"
          >
            ↻ 尝试重试恢复
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
