import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EMPTY_STATE_ICONS = {
  "no-images": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  "no-templates": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "no-selection": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  "no-preview": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  "no-history": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "no-model": (
    <svg className="w-16 h-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        className
      )}
    >
      {icon && <div className="mb-4 opacity-50">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
      {description && <p className="text-muted text-sm max-w-md mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-primary-strong hover:bg-primary text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface TypedEmptyStateProps {
  type: keyof typeof EMPTY_STATE_ICONS;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function TypedEmptyState({
  type,
  title,
  description,
  action,
  className,
}: TypedEmptyStateProps) {
  const defaultTitles: Record<typeof type, string> = {
    "no-images": "暂无图片",
    "no-templates": "暂无模板",
    "no-selection": "未选择区域",
    "no-preview": "暂无预览",
    "no-history": "暂无历史记录",
    "no-model": "模型未加载",
  };

  const defaultDescriptions: Record<typeof type, string> = {
    "no-images": "请导入图片开始处理，支持拖拽或点击上传。",
    "no-templates": "创建一个模板以快速应用相同的处理设置。",
    "no-selection": "请先在图片上框选要处理的区域。",
    "no-preview": "选择一张图片并配置处理参数后即可预览效果。",
    "no-history": "完成批量处理后，历史记录将显示在这里。",
    "no-model": "请先加载 AI 模型以使用智能修复功能。",
  };

  return (
    <EmptyState
      icon={EMPTY_STATE_ICONS[type]}
      title={title ?? defaultTitles[type]}
      description={description ?? defaultDescriptions[type]}
      action={action}
      className={className}
    />
  );
}
