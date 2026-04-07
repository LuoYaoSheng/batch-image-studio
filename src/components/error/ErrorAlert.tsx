import type { ErrorDetail } from "../../types";
import { cn } from "../../lib/utils";

interface ErrorAlertProps {
  error: ErrorDetail | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
}

export function ErrorAlert({
  error,
  onRetry,
  onDismiss,
  className,
  showIcon = true,
}: ErrorAlertProps) {
  if (!error) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800",
        className
      )}
      role="alert"
    >
      {showIcon && (
        <div className="shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-900 dark:text-red-200">{error.message}</p>
        {error.suggestion && (
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error.suggestion}</p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium underline text-red-800 hover:text-red-900 dark:text-red-300"
          >
            重试
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
          aria-label="关闭"
        >
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
