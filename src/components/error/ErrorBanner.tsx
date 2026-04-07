import type { ErrorDetail } from "../../types";
import { cn } from "../../lib/utils";

interface ErrorBannerProps {
  error: ErrorDetail | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ error, onRetry, onDismiss, className }: ErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full p-3 rounded-xl bg-red-50 border-l-4 border-red-500 flex items-center justify-between gap-4",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-900 dark:text-red-200 truncate">{error.message}</p>
          {error.suggestion && (
            <p className="text-xs text-red-700 dark:text-red-300 truncate">{error.suggestion}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            重试
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
