import { memo } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface ModelStatusIndicatorProps {
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
  progress: number;
  onRetry?: () => void;
}

export const ModelStatusIndicator = memo(
  ({ isLoaded, isLoading, isFailed, progress, onRetry }: ModelStatusIndicatorProps) => {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={
          isLoaded
            ? "AI 模型已就绪"
            : isFailed
              ? "AI 模型加载失败"
              : isLoading
                ? "AI 模型加载中"
                : "AI 模型未加载"
        }
        className="flex items-center gap-2 text-sm"
      >
        {isLoaded ? (
          <>
            <svg
              className="h-5 w-5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-green-600">AI 模型已就绪</span>
          </>
        ) : isFailed ? (
          <>
            <svg
              className="h-5 w-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-600">AI 模型加载失败</span>
            {onRetry && (
              <button
                type="button"
                className="ml-2 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/5"
                onClick={onRetry}
              >
                重试
              </button>
            )}
          </>
        ) : isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span className="text-muted">
              正在加载 AI 模型... {Math.round(progress)}%
            </span>
          </>
        ) : (
          <>
            <svg
              className="h-5 w-5 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-muted">AI 模型未加载</span>
          </>
        )}
      </div>
    );
  }
);

ModelStatusIndicator.displayName = "ModelStatusIndicator";
