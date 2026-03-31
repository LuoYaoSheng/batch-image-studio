import type { ModelSource } from "../types";
import { memo } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface ModelStatusIndicatorProps {
  hasCheckedStatus: boolean;
  isAvailable: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
  preferredModelSource: ModelSource | null;
  progress: number;
  onRetry?: () => void;
  onOpenModelDir?: () => void;
  onDownloadModel?: () => void;
}

export const ModelStatusIndicator = memo(
  ({ hasCheckedStatus, isAvailable, isLoaded, isLoading, isFailed, preferredModelSource, progress, onRetry, onOpenModelDir, onDownloadModel }: ModelStatusIndicatorProps) => {
    const sourceLabel =
      preferredModelSource === "local"
        ? "本地安装"
        : preferredModelSource === "bundled"
          ? "应用内置"
          : null;

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={
          !hasCheckedStatus
            ? "正在检查模型状态"
            : !isAvailable
            ? "AI 模型未安装"
            : isLoaded
            ? "AI 模型已就绪"
            : isFailed
              ? "AI 模型加载失败"
              : isLoading
                ? "AI 模型加载中"
                : "AI 模型未加载"
        }
        className="flex items-center gap-2 text-sm"
      >
        {!hasCheckedStatus ? (
          <>
            <LoadingSpinner size="sm" />
            <span className="text-muted">正在检查智能修复模型状态...</span>
          </>
        ) : !isAvailable ? (
          <>
            <svg
              className="h-5 w-5 text-amber-500"
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
            <span className="text-amber-700">需要先安装智能修复模型</span>
            {onDownloadModel ? (
              <button
                type="button"
                className="ml-2 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary/90"
                onClick={onDownloadModel}
              >
                下载模型包
              </button>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                className="ml-2 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/5"
                onClick={onRetry}
              >
                重新检查
              </button>
            ) : null}
            {onOpenModelDir ? (
              <button
                type="button"
                className="ml-2 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/5"
                onClick={onOpenModelDir}
              >
                打开模型目录
              </button>
            ) : null}
          </>
        ) : isLoaded ? (
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
            <span className="text-green-600">
              智能修复模型已就绪{sourceLabel ? ` · ${sourceLabel}` : ""}
            </span>
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
            <span className="text-red-600">智能修复模型加载失败</span>
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
              正在准备智能修复模型... {Math.round(progress)}%
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
            <span className="text-muted">
              智能修复模型待加载{sourceLabel ? ` · ${sourceLabel}` : ""}
            </span>
          </>
        )}
      </div>
    );
  }
);

ModelStatusIndicator.displayName = "ModelStatusIndicator";
