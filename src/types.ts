export type CleanupMethod = "blur" | "fill" | "crop";
export type SizeHandlingMode = "relative" | "absolute" | "bottomRight";
export type AppScreen =
  | "home"
  | "builder"
  | "preview"
  | "batch"
  | "templates"
  | "history"
  | "settings";
export type ImportDestination = "builder" | "preview";
export type OutputFormat = "png" | "jpg" | "webp";

export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImportedImage = {
  id: string;
  path: string;
  name: string;
  width: number;
  height: number;
  format: string;
  fileSize: number;
  thumbnailDataUrl: string;
  previewDataUrl: string;
};

export type ImportSummary = {
  items: ImportedImage[];
  warnings: string[];
};

export type PreviewResult = {
  processedImagePath: string;
  processedDisplayDataUrl: string;
  outputWidth: number;
  outputHeight: number;
  cachedProcessedPath: string;
};

export type MaskPreviewResult = {
  maskDataUrl: string;
};

export type PreviewTaskStarted = {
  taskId: string;
};

export type PreviewTaskEvent = {
  taskId: string;
  stage: "started" | "model-loading" | "processing" | "saving" | "completed" | "error";
  message: string;
  result?: PreviewResult | null;
  error?: string | null;
};

export type PreviewCache = {
  sourcePath: string;
  cachedProcessedPath: string;
  signature: string;
};

export type PreviewCacheEntry = {
  preview: PreviewResult;
  maskDataUrl: string | null;
  sourcePath: string;
  signature: string;
};

export type BatchEntry = {
  sourcePath: string;
  outputPath: string;
  cachedProcessedPath?: string | null;
  success: boolean;
  error?: string | null;
};

export type BatchResult = {
  outputDir: string;
  processedCount: number;
  successCount: number;
  failedCount: number;
  entries: BatchEntry[];
};

export type BatchProgressEvent = {
  total: number;
  completed: number;
  successCount: number;
  failedCount: number;
  currentFile: string;
  stage: "started" | "processing" | "completed" | "cancelled";
};

export type BatchTaskStarted = {
  taskId: string;
};

export type BatchTaskEvent = {
  taskId: string;
  stage: "started" | "completed" | "cancelled" | "error";
  message: string;
  result?: BatchResult | null;
  error?: string | null;
};

export type Template = {
  id: string;
  name: string;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  previewImage?: string;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  importedCount: number;
  successCount: number;
  failedCount: number;
  outputDir: string;
  cleanupMethod: CleanupMethod;
  templateId?: string;
  templateName?: string;
};

export type AppSettings = {
  defaultOutputDir: string;
  defaultFormat: OutputFormat;
  defaultCleanupMethod: CleanupMethod;
  defaultSizeHandlingMode: SizeHandlingMode;
  defaultFileNamingRule: FileNamingRule;
  customFileNamingPattern?: string;
};

export type FileNamingRule = "name_processed" | "name_cleaned" | "name_timestamp" | "custom";

function splitFileName(originalName: string) {
  const lastDotIndex = originalName.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0;

  return {
    baseName: hasExtension ? originalName.slice(0, lastDotIndex) : originalName,
    ext: hasExtension ? originalName.slice(lastDotIndex) : "",
  };
}

function normalizeOutputExtension(outputFormat?: OutputFormat) {
  switch (outputFormat) {
    case "jpg":
      return ".jpg";
    case "webp":
      return ".webp";
    case "png":
      return ".png";
    default:
      return "";
  }
}

function hasFileExtension(value: string) {
  const trimmed = value.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  const lastSeparatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return lastDotIndex > lastSeparatorIndex;
}

export function applyFileNamingRule(
  originalName: string,
  rule: FileNamingRule,
  customPattern?: string,
  index: number = 1,
  outputFormat?: OutputFormat
): string {
  const { baseName, ext: originalExt } = splitFileName(originalName);
  const ext = normalizeOutputExtension(outputFormat) || originalExt;

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  switch (rule) {
    case "name_processed":
      return `${baseName}_已处理${ext}`;
    case "name_cleaned":
      return `${baseName}_去除水印${ext}`;
    case "name_timestamp":
      return `${baseName}_${timestamp}${ext}`;
    case "custom":
      if (!customPattern?.trim()) {
        return `${baseName}_已处理${ext}`;
      }
      // 清理文件名中的非法字符 (Windows/Linux 文件系统限制)
      const sanitizedPattern = customPattern
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/{name}/g, baseName)
        .replace(/{timestamp}/g, timestamp)
        .replace(/{index}/g, String(index));
      const result = ext && !hasFileExtension(sanitizedPattern) ? `${sanitizedPattern}${ext}` : sanitizedPattern;
      // 确保结果不为空
      return result.trim() || `${baseName}_已处理${ext}`;
    default:
      return `${baseName}_已处理${ext}`;
  }
}

// Model loading state types
// Note: Rust struct uses snake_case (is_loaded), but serde rename_all = "camelCase" handles conversion
export type ModelLoadStatus = "not-loaded" | "loading" | "loaded" | "failed";

export type ModelSource = "local" | "bundled";

export type InstallModelPackageResponse = {
  profileId: string;
  displayName: string;
  version: string;
  installDir: string;
};

export type ModelPackageTaskStarted = {
  taskId: string;
};

export type ModelStatusResponse = {
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
  isAvailable: boolean;
  preferredModelSource?: ModelSource | null;
  localModelsDir: string;
};

export type ModelLoadProgressEvent = {
  progress: number;
};

export type ModelLoadErrorEvent = {
  error: string;
};

export type ModelPackageDownloadProgressEvent = {
  progress: number;
};

export type ModelPackageTaskEvent = {
  taskId: string;
  stage: "completed" | "error";
  message: string;
  result?: InstallModelPackageResponse | null;
  error?: string | null;
};

// Feedback system types
export type ToastKind = "info" | "success" | "error" | "warning";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
};

export type ErrorCode =
  | "MODEL_NOT_LOADED"
  | "MODEL_LOAD_FAILED"
  | "IMAGE_READ_FAILED"
  | "BATCH_PROCESSING_FAILED"
  | "OUTPUT_DIR_NOT_ACCESSIBLE"
  | "TEMPLATE_SAVE_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type ErrorDetail = {
  code: ErrorCode;
  message: string;
  suggestion?: string;
  retryAction?: () => void;
};

export type EmptyStateType =
  | "no-images"
  | "no-templates"
  | "no-selection"
  | "no-preview"
  | "no-history"
  | "no-model";
