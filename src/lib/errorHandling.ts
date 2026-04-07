import type { ErrorCode, ErrorDetail } from "../types";

interface ErrorConfig {
  message: string;
  suggestion: string;
  retryable: boolean;
}

const ERROR_CONFIGS: Record<ErrorCode, ErrorConfig> = {
  MODEL_NOT_LOADED: {
    message: "AI 模型未加载",
    suggestion: "请等待模型加载完成后再试，或前往设置页面手动加载模型。",
    retryable: true,
  },
  MODEL_LOAD_FAILED: {
    message: "AI 模型加载失败",
    suggestion: "请检查网络连接，或尝试重启应用后重试。",
    retryable: true,
  },
  IMAGE_READ_FAILED: {
    message: "图片读取失败",
    suggestion: "请确认图片文件完整且格式支持，或尝试重新导入。",
    retryable: true,
  },
  BATCH_PROCESSING_FAILED: {
    message: "批量处理失败",
    suggestion: "部分图片处理出错，请检查输出目录权限或尝试减少处理数量。",
    retryable: true,
  },
  OUTPUT_DIR_NOT_ACCESSIBLE: {
    message: "输出目录不可访问",
    suggestion: "请在设置中更换有效的输出目录，或检查目录权限。",
    retryable: false,
  },
  TEMPLATE_SAVE_FAILED: {
    message: "模板保存失败",
    suggestion: "请检查存储空间，或稍后重试。",
    retryable: true,
  },
  NETWORK_ERROR: {
    message: "网络连接失败",
    suggestion: "请检查网络连接后重试。",
    retryable: true,
  },
  UNKNOWN_ERROR: {
    message: "未知错误",
    suggestion: "请稍后重试，如问题持续存在，请联系技术支持。",
    retryable: true,
  },
};

export function createError(
  code: ErrorCode,
  customMessage?: string,
  customSuggestion?: string
): ErrorDetail {
  const config = ERROR_CONFIGS[code];
  return {
    code,
    message: customMessage ?? config.message,
    suggestion: customSuggestion ?? config.suggestion,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "发生未知错误";
}

export function getErrorCode(error: unknown): ErrorCode {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("model") || message.includes("模型")) {
    if (message.includes("load") || message.includes("加载")) {
      return "MODEL_LOAD_FAILED";
    }
    return "MODEL_NOT_LOADED";
  }
  if (message.includes("image") || message.includes("图片")) {
    return "IMAGE_READ_FAILED";
  }
  if (message.includes("batch") || message.includes("批量")) {
    return "BATCH_PROCESSING_FAILED";
  }
  if (message.includes("output") || message.includes("输出") || message.includes("directory") || message.includes("目录")) {
    return "OUTPUT_DIR_NOT_ACCESSIBLE";
  }
  if (message.includes("template") || message.includes("模板")) {
    return "TEMPLATE_SAVE_FAILED";
  }
  if (message.includes("network") || message.includes("网络") || message.includes("fetch")) {
    return "NETWORK_ERROR";
  }

  return "UNKNOWN_ERROR";
}

export function handleError(error: unknown, context?: string): ErrorDetail {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return createError(code, context ? `${context}: ${message}` : message);
}

export function isRetryable(error: ErrorDetail): boolean {
  return ERROR_CONFIGS[error.code].retryable;
}

export function logError(error: ErrorDetail, context?: string): void {
  console.error(`[${error.code}]${context ? ` ${context}` : ""}`, error.message, error.suggestion);
}
