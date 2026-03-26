import type { CleanupMethod, HistoryEntry, Template } from "../types";

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number) {
  if (ms <= 0) {
    return "少于 1 秒";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${seconds} 秒`;
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString();
}

export function formatRelativeTime(value?: string) {
  if (!value) {
    return "刚刚";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天前`;
}

export function getCleanupMethodLabel(method: CleanupMethod) {
  switch (method) {
    case "fill":
      return "纯色填充";
    case "crop":
      return "裁切";
    default:
      return "AI修复";
  }
}

export function getTemplateTimestamp(template: Template) {
  return template.updatedAt ?? template.lastUsedAt ?? template.createdAt;
}

export function getHistoryTemplateLabel(entry: HistoryEntry) {
  return entry.templateName ?? getCleanupMethodLabel(entry.cleanupMethod);
}
