export type CleanupMethod = "blur" | "fill" | "crop";
export type DetectionMode = "fixed" | "auto" | "hybrid";
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
  sourceDataUrl: string;
  processedDataUrl: string;
  outputWidth: number;
  outputHeight: number;
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
