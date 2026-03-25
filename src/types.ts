export type CleanupMethod = "blur" | "fill" | "crop";
export type SizeHandlingMode = "relative" | "absolute" | "bottomRight";

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
  stage: "started" | "processing" | "completed";
};

export type Template = {
  id: string;
  name: string;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  importedCount: number;
  successCount: number;
  failedCount: number;
  outputDir: string;
  cleanupMethod: CleanupMethod;
};
