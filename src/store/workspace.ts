import { create } from "zustand";
import type {
  BatchResult,
  CleanupMethod,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
  PreviewResult,
  Region,
  SizeHandlingMode,
  Template,
} from "../types";

const TEMPLATES_KEY = "batch-image-studio.templates";
const HISTORY_KEY = "batch-image-studio.history";

function computeDoubaoRegion(width: number, height: number): Region {
  const shortSide = Math.max(1, Math.min(width, height));
  const watermarkWidth = (0.205 * shortSide) / width;
  const watermarkHeight = (0.062 * shortSide) / height;
  const rightMargin = (0.018 * shortSide) / width;
  const bottomMargin = (0.016 * shortSide) / height;

  return {
    x: Math.max(0.01, 1 - rightMargin - watermarkWidth),
    y: Math.max(0.01, 1 - bottomMargin - watermarkHeight),
    width: Math.min(0.34, watermarkWidth),
    height: Math.min(0.14, watermarkHeight),
  };
}

function loadArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

type WorkspaceState = {
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  outputDir: string;
  region: Region;
  importedImages: ImportedImage[];
  selectedImageId: string | null;
  warnings: string[];
  preview: PreviewResult | null;
  templates: Template[];
  history: HistoryEntry[];
  isImporting: boolean;
  isPreviewLoading: boolean;
  isBatchRunning: boolean;
  notification: { kind: "info" | "success" | "error"; message: string } | null;
  lastBatchResult: BatchResult | null;
  setCleanupMethod: (method: CleanupMethod) => void;
  setSizeHandlingMode: (mode: SizeHandlingMode) => void;
  setBlurSigma: (sigma: number) => void;
  setFillColor: (color: string) => void;
  setOutputDir: (path: string) => void;
  updateRegion: (patch: Partial<Region>) => void;
  resetRegionFromImage: (image: ImportedImage | null) => void;
  setImporting: (value: boolean) => void;
  setPreviewLoading: (value: boolean) => void;
  setBatchRunning: (value: boolean) => void;
  setNotification: (value: { kind: "info" | "success" | "error"; message: string } | null) => void;
  applyImportSummary: (summary: ImportSummary) => void;
  selectImage: (id: string) => void;
  removeImage: (id: string) => void;
  clearWorkspace: () => void;
  setPreview: (preview: PreviewResult | null) => void;
  setLastBatchResult: (result: BatchResult | null) => void;
  saveTemplate: (name: string) => void;
  applyTemplate: (id: string) => void;
  addHistory: (entry: HistoryEntry) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  cleanupMethod: "blur",
  sizeHandlingMode: "relative",
  blurSigma: 10,
  fillColor: "#f7f9fc",
  outputDir: "",
  region: computeDoubaoRegion(2048, 2048),
  importedImages: [],
  selectedImageId: null,
  warnings: [],
  preview: null,
  templates: loadArray<Template>(TEMPLATES_KEY),
  history: loadArray<HistoryEntry>(HISTORY_KEY),
  isImporting: false,
  isPreviewLoading: false,
  isBatchRunning: false,
  notification: null,
  lastBatchResult: null,
  setCleanupMethod: (cleanupMethod) => set({ cleanupMethod }),
  setSizeHandlingMode: (sizeHandlingMode) => set({ sizeHandlingMode }),
  setBlurSigma: (blurSigma) => set({ blurSigma }),
  setFillColor: (fillColor) => set({ fillColor }),
  setOutputDir: (outputDir) => set({ outputDir }),
  updateRegion: (patch) =>
    set((state) => ({
      region: {
        ...state.region,
        ...patch,
      },
    })),
  resetRegionFromImage: (image) =>
    set({
      region: image ? computeDoubaoRegion(image.width, image.height) : computeDoubaoRegion(2048, 2048),
    }),
  setImporting: (isImporting) => set({ isImporting }),
  setPreviewLoading: (isPreviewLoading) => set({ isPreviewLoading }),
  setBatchRunning: (isBatchRunning) => set({ isBatchRunning }),
  setNotification: (notification) => set({ notification }),
  applyImportSummary: (summary) =>
    set({
      importedImages: summary.items,
      warnings: summary.warnings,
      selectedImageId: summary.items[0]?.id ?? null,
      region: summary.items[0]
        ? computeDoubaoRegion(summary.items[0].width, summary.items[0].height)
        : computeDoubaoRegion(2048, 2048),
      preview: null,
      lastBatchResult: null,
      notification:
        summary.items.length > 0
          ? { kind: "success", message: `已导入 ${summary.items.length} 张图片，可开始定位和预览。` }
          : { kind: "info", message: "没有导入到可处理图片，请重新选择文件或文件夹。" },
    }),
  selectImage: (selectedImageId) =>
    set((state) => {
      const image = state.importedImages.find((item) => item.id === selectedImageId) ?? null;
      return {
        selectedImageId,
        region: image ? computeDoubaoRegion(image.width, image.height) : state.region,
        preview: null,
      };
    }),
  removeImage: (id) =>
    set((state) => {
      const remaining = state.importedImages.filter((item) => item.id !== id);
      const nextSelected =
        state.selectedImageId === id ? (remaining[0]?.id ?? null) : state.selectedImageId;

      return {
        importedImages: remaining,
        selectedImageId: nextSelected,
        preview: null,
        lastBatchResult: null,
        notification:
          remaining.length > 0
            ? { kind: "info", message: `已移除 1 张图片，当前剩余 ${remaining.length} 张。` }
            : { kind: "info", message: "当前任务已清空，可重新导入图片或文件夹。" },
      };
    }),
  clearWorkspace: () =>
    set({
      importedImages: [],
      selectedImageId: null,
      warnings: [],
      preview: null,
      lastBatchResult: null,
      notification: { kind: "info", message: "当前任务已清空，可重新导入图片或文件夹。" },
    }),
  setPreview: (preview) => set({ preview }),
  setLastBatchResult: (lastBatchResult) => set({ lastBatchResult }),
  saveTemplate: (name) => {
    const state = get();
    const nextTemplates = [
      {
        id: crypto.randomUUID(),
        name,
        region: state.region,
        cleanupMethod: state.cleanupMethod,
        sizeHandlingMode: state.sizeHandlingMode,
        blurSigma: state.blurSigma,
        fillColor: state.fillColor,
      },
      ...state.templates,
    ].slice(0, 12);

    saveArray(TEMPLATES_KEY, nextTemplates);
    set({ templates: nextTemplates });
  },
  applyTemplate: (id) => {
    const template = get().templates.find((item) => item.id === id);
    if (!template) {
      return;
    }

    set({
      region: template.region,
      cleanupMethod: template.cleanupMethod,
      sizeHandlingMode: template.sizeHandlingMode,
      blurSigma: template.blurSigma,
      fillColor: template.fillColor,
    });
  },
  addHistory: (entry) => {
    const nextHistory = [entry, ...get().history].slice(0, 20);
    saveArray(HISTORY_KEY, nextHistory);
    set({ history: nextHistory });
  },
}));
