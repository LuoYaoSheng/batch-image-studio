import { create } from "zustand";
import type {
  BatchResult,
  CleanupMethod,
  DetectionMode,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
  PreviewResult,
  Region,
  Template,
} from "../types";

const TEMPLATES_KEY = "batch-image-studio.templates";
const HISTORY_KEY = "batch-image-studio.history";

const defaultRegion: Region = {
  x: 0.72,
  y: 0.78,
  width: 0.22,
  height: 0.14,
};

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
  detectionMode: DetectionMode;
  cleanupMethod: CleanupMethod;
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
  lastBatchResult: BatchResult | null;
  setDetectionMode: (mode: DetectionMode) => void;
  setCleanupMethod: (method: CleanupMethod) => void;
  setBlurSigma: (sigma: number) => void;
  setFillColor: (color: string) => void;
  setOutputDir: (path: string) => void;
  updateRegion: (patch: Partial<Region>) => void;
  setImporting: (value: boolean) => void;
  setPreviewLoading: (value: boolean) => void;
  setBatchRunning: (value: boolean) => void;
  applyImportSummary: (summary: ImportSummary) => void;
  selectImage: (id: string) => void;
  setPreview: (preview: PreviewResult | null) => void;
  setLastBatchResult: (result: BatchResult | null) => void;
  saveTemplate: (name: string) => void;
  applyTemplate: (id: string) => void;
  addHistory: (entry: HistoryEntry) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  detectionMode: "fixed",
  cleanupMethod: "blur",
  blurSigma: 10,
  fillColor: "#f7f9fc",
  outputDir: "",
  region: defaultRegion,
  importedImages: [],
  selectedImageId: null,
  warnings: [],
  preview: null,
  templates: loadArray<Template>(TEMPLATES_KEY),
  history: loadArray<HistoryEntry>(HISTORY_KEY),
  isImporting: false,
  isPreviewLoading: false,
  isBatchRunning: false,
  lastBatchResult: null,
  setDetectionMode: (detectionMode) => set({ detectionMode }),
  setCleanupMethod: (cleanupMethod) => set({ cleanupMethod }),
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
  setImporting: (isImporting) => set({ isImporting }),
  setPreviewLoading: (isPreviewLoading) => set({ isPreviewLoading }),
  setBatchRunning: (isBatchRunning) => set({ isBatchRunning }),
  applyImportSummary: (summary) =>
    set({
      importedImages: summary.items,
      warnings: summary.warnings,
      selectedImageId: summary.items[0]?.id ?? null,
      preview: null,
      lastBatchResult: null,
    }),
  selectImage: (selectedImageId) => set({ selectedImageId, preview: null }),
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
