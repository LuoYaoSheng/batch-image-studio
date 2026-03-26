import { create } from "zustand";
import type {
  AppScreen,
  AppSettings,
  BatchResult,
  CleanupMethod,
  HistoryEntry,
  ImportDestination,
  ImportSummary,
  ImportedImage,
  PreviewResult,
  Region,
  SizeHandlingMode,
  Template,
} from "../types";

const TEMPLATES_KEY = "batch-image-studio.templates";
const HISTORY_KEY = "batch-image-studio.history";
const APP_SETTINGS_KEY = "batch-image-studio.app-settings";

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: "",
  defaultFormat: "png",
  defaultCleanupMethod: "blur",
  defaultSizeHandlingMode: "bottomRight",
};

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

function loadObject<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveObject<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function hydrateTemplate(template: Template): Template {
  const now = new Date().toISOString();
  return {
    ...template,
    createdAt: template.createdAt ?? now,
    updatedAt: template.updatedAt ?? template.createdAt ?? now,
  };
}

type WorkspaceState = {
  navigation: {
    currentScreen: AppScreen;
    builderMode: "new" | "edit";
    pendingImportDestination: ImportDestination;
  };
  appSettings: AppSettings;
  currentTemplateId: string | null;
  currentTemplateName: string;
  isTemplateDirty: boolean;
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
  isModelLoading: boolean;
  isModelLoaded: boolean;
  modelLoadProgress: number;
  setCurrentScreen: (screen: AppScreen) => void;
  setBuilderMode: (mode: "new" | "edit") => void;
  setPendingImportDestination: (screen: ImportDestination) => void;
  startNewTemplateSession: () => void;
  setCurrentTemplateName: (name: string) => void;
  markTemplateDirty: (value: boolean) => void;
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
  saveTemplate: (name?: string) => Template | null;
  applyTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  addHistory: (entry: HistoryEntry) => void;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  setModelLoading: (value: boolean) => void;
  setModelLoaded: (value: boolean) => void;
  setModelLoadProgress: (value: number) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const appSettings = loadObject(APP_SETTINGS_KEY, DEFAULT_SETTINGS);
  const templates = loadArray<Template>(TEMPLATES_KEY).map(hydrateTemplate);

  return {
    navigation: {
      currentScreen: "home",
      builderMode: "new",
      pendingImportDestination: "builder",
    },
    appSettings,
    currentTemplateId: null,
    currentTemplateName: "",
    isTemplateDirty: false,
    cleanupMethod: appSettings.defaultCleanupMethod,
    sizeHandlingMode: appSettings.defaultSizeHandlingMode,
    blurSigma: 10,
    fillColor: "#f7f9fc",
    outputDir: appSettings.defaultOutputDir,
    region: computeDoubaoRegion(2048, 2048),
    importedImages: [],
    selectedImageId: null,
    warnings: [],
    preview: null,
    templates,
    history: loadArray<HistoryEntry>(HISTORY_KEY),
    isImporting: false,
    isPreviewLoading: false,
    isBatchRunning: false,
    notification: null,
    lastBatchResult: null,
    isModelLoading: false,
    isModelLoaded: false,
    modelLoadProgress: 0,
    setCurrentScreen: (currentScreen) =>
      set((state) => ({
        navigation: {
          ...state.navigation,
          currentScreen,
        },
      })),
    setBuilderMode: (builderMode) =>
      set((state) => ({
        navigation: {
          ...state.navigation,
          builderMode,
        },
      })),
    setPendingImportDestination: (pendingImportDestination) =>
      set((state) => ({
        navigation: {
          ...state.navigation,
          pendingImportDestination,
        },
      })),
    startNewTemplateSession: () =>
      set((state) => ({
        currentTemplateId: null,
        currentTemplateName: "",
        isTemplateDirty: false,
        cleanupMethod: state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
        outputDir: state.appSettings.defaultOutputDir,
        preview: null,
        lastBatchResult: null,
        navigation: {
          ...state.navigation,
          builderMode: "new",
          pendingImportDestination: "builder",
        },
      })),
    setCurrentTemplateName: (currentTemplateName) =>
      set({
        currentTemplateName,
        isTemplateDirty: true,
      }),
    markTemplateDirty: (isTemplateDirty) => set({ isTemplateDirty }),
    setCleanupMethod: (cleanupMethod) =>
      set({
        cleanupMethod,
        isTemplateDirty: true,
      }),
    setSizeHandlingMode: (sizeHandlingMode) =>
      set({
        sizeHandlingMode,
        isTemplateDirty: true,
      }),
    setBlurSigma: (blurSigma) =>
      set({
        blurSigma,
        isTemplateDirty: true,
      }),
    setFillColor: (fillColor) =>
      set({
        fillColor,
        isTemplateDirty: true,
      }),
    setOutputDir: (outputDir) =>
      set({
        outputDir,
        isTemplateDirty: true,
      }),
    updateRegion: (patch) =>
      set((state) => ({
        region: {
          ...state.region,
          ...patch,
        },
        isTemplateDirty: true,
      })),
    resetRegionFromImage: (image) =>
      set({
        region: image ? computeDoubaoRegion(image.width, image.height) : computeDoubaoRegion(2048, 2048),
        isTemplateDirty: true,
      }),
    setImporting: (isImporting) => set({ isImporting }),
    setPreviewLoading: (isPreviewLoading) => set({ isPreviewLoading }),
    setBatchRunning: (isBatchRunning) => set({ isBatchRunning }),
    setNotification: (notification) => set({ notification }),
    applyImportSummary: (summary) =>
      set((state) => ({
        importedImages: summary.items,
        warnings: summary.warnings,
        selectedImageId: summary.items[0]?.id ?? null,
        region: state.currentTemplateId
          ? state.region
          : summary.items[0]
            ? computeDoubaoRegion(summary.items[0].width, summary.items[0].height)
            : computeDoubaoRegion(2048, 2048),
        cleanupMethod: state.currentTemplateId
          ? state.cleanupMethod
          : state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.currentTemplateId
          ? state.sizeHandlingMode
          : state.appSettings.defaultSizeHandlingMode,
        outputDir: state.outputDir || state.appSettings.defaultOutputDir,
        preview: null,
        lastBatchResult: null,
        notification:
          summary.items.length > 0
            ? { kind: "success", message: `已导入 ${summary.items.length} 张图片，可开始模板构建。` }
            : { kind: "info", message: "没有导入到可处理图片，请重新选择文件或文件夹。" },
      })),
    selectImage: (selectedImageId) =>
      set({
        selectedImageId,
        preview: null,
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
      set((state) => ({
        importedImages: [],
        selectedImageId: null,
        warnings: [],
        preview: null,
        lastBatchResult: null,
        currentTemplateId: null,
        currentTemplateName: "",
        isTemplateDirty: false,
        cleanupMethod: state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
        outputDir: state.appSettings.defaultOutputDir,
        notification: { kind: "info", message: "当前任务已清空，可重新导入图片或文件夹。" },
      })),
    setPreview: (preview) => set({ preview }),
    setLastBatchResult: (lastBatchResult) => set({ lastBatchResult }),
    saveTemplate: (name) => {
      const state = get();
      const now = new Date().toISOString();
      const nextName = (name ?? state.currentTemplateName).trim();
      if (!nextName) {
        return null;
      }

      let savedTemplate: Template;
      let nextTemplates: Template[];

      if (state.currentTemplateId) {
        nextTemplates = state.templates.map((template) => {
          if (template.id !== state.currentTemplateId) {
            return template;
          }
          savedTemplate = {
            ...template,
            name: nextName,
            region: state.region,
            cleanupMethod: state.cleanupMethod,
            sizeHandlingMode: state.sizeHandlingMode,
            blurSigma: state.blurSigma,
            fillColor: state.fillColor,
            previewImage: state.importedImages[0]?.thumbnailDataUrl ?? template.previewImage,
            updatedAt: now,
          };
          return savedTemplate;
        });
        if (!savedTemplate!) {
          return null;
        }
      } else {
        savedTemplate = {
          id: crypto.randomUUID(),
          name: nextName,
          region: state.region,
          cleanupMethod: state.cleanupMethod,
          sizeHandlingMode: state.sizeHandlingMode,
          blurSigma: state.blurSigma,
          fillColor: state.fillColor,
          previewImage: state.importedImages[0]?.thumbnailDataUrl,
          createdAt: now,
          updatedAt: now,
        };
        nextTemplates = [savedTemplate, ...state.templates].slice(0, 24);
      }

      saveArray(TEMPLATES_KEY, nextTemplates);
      set({
        templates: nextTemplates,
        currentTemplateId: savedTemplate.id,
        currentTemplateName: savedTemplate.name,
        isTemplateDirty: false,
        navigation: {
          ...state.navigation,
          builderMode: "edit",
        },
      });
      return savedTemplate;
    },
    applyTemplate: (id) => {
      const template = get().templates.find((item) => item.id === id);
      if (!template) {
        return;
      }

      const now = new Date().toISOString();
      const nextTemplates = get().templates.map((item) =>
        item.id === id
          ? {
              ...item,
              lastUsedAt: now,
            }
          : item,
      );

      saveArray(TEMPLATES_KEY, nextTemplates);
      set((state) => ({
        templates: nextTemplates,
        currentTemplateId: template.id,
        currentTemplateName: template.name,
        region: template.region,
        cleanupMethod: template.cleanupMethod,
        sizeHandlingMode: template.sizeHandlingMode,
        blurSigma: template.blurSigma,
        fillColor: template.fillColor,
        isTemplateDirty: false,
        preview: null,
        navigation: {
          ...state.navigation,
          builderMode: "edit",
        },
      }));
    },
    deleteTemplate: (id) =>
      set((state) => {
        const nextTemplates = state.templates.filter((item) => item.id !== id);
        saveArray(TEMPLATES_KEY, nextTemplates);

        return {
          templates: nextTemplates,
          currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId,
          currentTemplateName: state.currentTemplateId === id ? "" : state.currentTemplateName,
          isTemplateDirty: state.currentTemplateId === id ? false : state.isTemplateDirty,
        };
      }),
    addHistory: (entry) => {
      const nextHistory = [entry, ...get().history].slice(0, 50);
      saveArray(HISTORY_KEY, nextHistory);
      set({ history: nextHistory });
    },
    updateAppSettings: (patch) =>
      set((state) => {
        const nextSettings = {
          ...state.appSettings,
          ...patch,
        };
        saveObject(APP_SETTINGS_KEY, nextSettings);
        return {
          appSettings: nextSettings,
        };
      }),
    setModelLoading: (isModelLoading) => set({ isModelLoading }),
    setModelLoaded: (isModelLoaded) => set({ isModelLoaded }),
    setModelLoadProgress: (modelLoadProgress) => set({ modelLoadProgress }),
  };
});
