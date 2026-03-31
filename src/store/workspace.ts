import { create } from "zustand";
import { getModelRuntimeStatus, preloadModelRuntime } from "../lib/modelRuntime";
import {
  createStarterTemplates,
  loadPersistedHistory,
  loadPersistedSettings,
  loadPersistedTemplates,
  savePersistedHistory,
  savePersistedSettings,
  savePersistedTemplates,
} from "./persistence";
import type {
  AppScreen,
  AppSettings,
  BatchResult,
  CleanupMethod,
  HistoryEntry,
  ImportDestination,
  ImportSummary,
  ImportedImage,
  ModelStatusResponse,
  PreviewResult,
  Region,
  SizeHandlingMode,
  Template,
} from "../types";
const DEFAULT_BLUR_SIGMA = 10;
const DEFAULT_FILL_COLOR = "#f7f9fc";

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: "",
  defaultFormat: "png",
  defaultCleanupMethod: "blur",
  defaultSizeHandlingMode: "bottomRight",
  defaultFileNamingRule: "name_processed",
  customFileNamingPattern: "",
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

const DEFAULT_REGION = computeDoubaoRegion(2048, 2048);

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
  hasRegionSelection: boolean;
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
  isModelFailed: boolean;
  isModelAvailable: boolean;
  hasCheckedModelStatus: boolean;
  modelInstallDir: string;
  preferredModelSource: "local" | "bundled" | null;
  modelLoadProgress: number;
  setCurrentScreen: (screen: AppScreen) => void;
  setBuilderMode: (mode: "new" | "edit") => void;
  setPendingImportDestination: (screen: ImportDestination) => void;
  startNewTemplateSession: () => void;
  setCurrentTemplateName: (name: string) => void;
  markTemplateDirty: (value: boolean) => void;
  clearRegionSelection: () => void;
  resetCurrentRegionSettings: () => void;
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
  appendImportSummary: (summary: ImportSummary) => void;
  selectImage: (id: string) => void;
  removeImage: (id: string) => void;
  clearPreviewState: () => void;
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
  setModelFailed: (value: boolean) => void;
  setModelLoadProgress: (value: number) => void;
  preloadModel: () => Promise<void>;
  getModelStatus: () => Promise<ModelStatusResponse>;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const appSettings = loadPersistedSettings(DEFAULT_SETTINGS);
  const storedTemplates = loadPersistedTemplates();
  const templates = storedTemplates.length > 0 ? storedTemplates : createStarterTemplates();
  if (storedTemplates.length === 0) {
    savePersistedTemplates(templates);
  }

  function getTemplatePreviewImage(state: WorkspaceState) {
    return state.importedImages.find((item) => item.id === state.selectedImageId)?.path;
  }

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
    hasRegionSelection: false,
    cleanupMethod: appSettings.defaultCleanupMethod,
    sizeHandlingMode: appSettings.defaultSizeHandlingMode,
    blurSigma: DEFAULT_BLUR_SIGMA,
    fillColor: DEFAULT_FILL_COLOR,
    outputDir: appSettings.defaultOutputDir,
    region: DEFAULT_REGION,
    importedImages: [],
    selectedImageId: null,
    warnings: [],
    preview: null,
    templates,
    history: loadPersistedHistory(),
    isImporting: false,
    isPreviewLoading: false,
    isBatchRunning: false,
    notification: null,
    lastBatchResult: null,
    isModelLoading: false,
    isModelLoaded: false,
    isModelFailed: false,
    isModelAvailable: false,
    hasCheckedModelStatus: false,
    modelInstallDir: "",
    preferredModelSource: null,
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
        hasRegionSelection: false,
        cleanupMethod: state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
        blurSigma: DEFAULT_BLUR_SIGMA,
        fillColor: DEFAULT_FILL_COLOR,
        outputDir: state.appSettings.defaultOutputDir,
        region: DEFAULT_REGION,
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
    clearRegionSelection: () =>
      set({
        hasRegionSelection: false,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      }),
    resetCurrentRegionSettings: () =>
      set((state) => ({
        cleanupMethod: state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
        blurSigma: DEFAULT_BLUR_SIGMA,
        fillColor: DEFAULT_FILL_COLOR,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      })),
    setCleanupMethod: (cleanupMethod) =>
      set({
        cleanupMethod,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      }),
    setSizeHandlingMode: (sizeHandlingMode) =>
      set({
        sizeHandlingMode,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      }),
    setBlurSigma: (blurSigma) =>
      set({
        blurSigma,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      }),
    setFillColor: (fillColor) =>
      set({
        fillColor,
        preview: null,
        lastBatchResult: null,
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
        hasRegionSelection: true,
        preview: null,
        lastBatchResult: null,
        isTemplateDirty: true,
      })),
    resetRegionFromImage: (image) =>
      set({
        region: image ? computeDoubaoRegion(image.width, image.height) : DEFAULT_REGION,
        hasRegionSelection: true,
        preview: null,
        lastBatchResult: null,
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
            : DEFAULT_REGION,
        hasRegionSelection: state.currentTemplateId ? state.hasRegionSelection : summary.items.length > 0,
        cleanupMethod: state.currentTemplateId
          ? state.cleanupMethod
          : state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.currentTemplateId
          ? state.sizeHandlingMode
          : state.appSettings.defaultSizeHandlingMode,
        blurSigma: state.currentTemplateId ? state.blurSigma : DEFAULT_BLUR_SIGMA,
        fillColor: state.currentTemplateId ? state.fillColor : DEFAULT_FILL_COLOR,
        outputDir: state.outputDir || state.appSettings.defaultOutputDir,
        preview: null,
        lastBatchResult: null,
        notification:
          summary.items.length > 0
            ? { kind: "success", message: `已导入 ${summary.items.length} 张图片，可开始模板构建。` }
            : { kind: "info", message: "没有导入到可处理图片，请重新选择文件或文件夹。" },
      })),
    appendImportSummary: (summary) =>
      set((state) => {
        const currentByPath = new Map(state.importedImages.map((item) => [item.path, item]));
        for (const item of summary.items) {
          currentByPath.set(item.path, item);
        }

        const nextImages = Array.from(currentByPath.values());
        const selectedStillExists = nextImages.some((item) => item.id === state.selectedImageId);

        return {
          importedImages: nextImages,
          warnings: [...state.warnings, ...summary.warnings],
          selectedImageId: selectedStillExists ? state.selectedImageId : (nextImages[0]?.id ?? null),
          notification:
            summary.items.length > 0
              ? {
                  kind: "success",
                  message: `已追加 ${summary.items.length} 张图片，当前任务共 ${nextImages.length} 张。`,
                }
              : { kind: "info", message: "没有追加到新的可处理图片。" },
        };
      }),
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
    clearPreviewState: () =>
      set({
        preview: null,
        lastBatchResult: null,
      }),
    clearWorkspace: () =>
      set((state) => ({
        importedImages: [],
        selectedImageId: null,
        warnings: [],
        preview: null,
        lastBatchResult: null,
        hasRegionSelection: false,
        currentTemplateId: null,
        currentTemplateName: "",
        isTemplateDirty: false,
        cleanupMethod: state.appSettings.defaultCleanupMethod,
        sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
        blurSigma: DEFAULT_BLUR_SIGMA,
        fillColor: DEFAULT_FILL_COLOR,
        outputDir: state.appSettings.defaultOutputDir,
        region: DEFAULT_REGION,
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
            previewImage: getTemplatePreviewImage(state) ?? template.previewImage,
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
          previewImage: getTemplatePreviewImage(state),
          createdAt: now,
          updatedAt: now,
        };
        nextTemplates = [savedTemplate, ...state.templates].slice(0, 24);
      }

      savePersistedTemplates(nextTemplates);
      set({
        templates: nextTemplates,
        currentTemplateId: savedTemplate.id,
        currentTemplateName: savedTemplate.name,
        hasRegionSelection: true,
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

      savePersistedTemplates(nextTemplates);
      set((state) => ({
        templates: nextTemplates,
        currentTemplateId: template.id,
        currentTemplateName: template.name,
        region: template.region,
        cleanupMethod: template.cleanupMethod,
        sizeHandlingMode: template.sizeHandlingMode,
        blurSigma: template.blurSigma,
        fillColor: template.fillColor,
        hasRegionSelection: true,
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
        savePersistedTemplates(nextTemplates);

        return {
          templates: nextTemplates,
          currentTemplateId: state.currentTemplateId === id ? null : state.currentTemplateId,
          currentTemplateName: state.currentTemplateId === id ? "" : state.currentTemplateName,
          isTemplateDirty: state.currentTemplateId === id ? false : state.isTemplateDirty,
        };
      }),
    addHistory: (entry) => {
      const nextHistory = [entry, ...get().history].slice(0, 50);
      savePersistedHistory(nextHistory);
      set({ history: nextHistory });
    },
    updateAppSettings: (patch) =>
      set((state) => {
        const nextSettings = {
          ...state.appSettings,
          ...patch,
        };
        savePersistedSettings(nextSettings);
        return {
          appSettings: nextSettings,
        };
      }),
    setModelLoading: (isModelLoading) => set({ isModelLoading }),
    setModelLoaded: (isModelLoaded) => set({ isModelLoaded, isModelFailed: false, modelLoadProgress: 100 }),
    setModelFailed: (isModelFailed) => set({ isModelFailed, isModelLoading: false, isModelLoaded: false }),
    setModelLoadProgress: (modelLoadProgress) => set({ modelLoadProgress }),
    preloadModel: async () => {
      // 并发保护：如果已在加载中，直接返回
      const state = get();
      if (state.isModelLoading || state.isModelLoaded) {
        return;
      }

      try {
        set({ isModelLoading: true, isModelFailed: false, modelLoadProgress: 0 });
        await preloadModelRuntime();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          isModelLoading: false,
          isModelFailed: true,
          notification: {
            kind: "error",
            message: `AI 模型加载失败: ${errorMessage}`,
          },
        });
      }
    },
    getModelStatus: async () => {
      try {
        const status = await getModelRuntimeStatus();
        set({
          isModelLoaded: status.isLoaded,
          isModelLoading: status.isLoading,
          isModelFailed: status.isFailed,
          isModelAvailable: status.isAvailable,
          hasCheckedModelStatus: true,
          modelInstallDir: status.localModelsDir,
          preferredModelSource: status.preferredModelSource ?? null,
        });
        return status;
      } catch (error) {
        console.error("Failed to get model status:", error);
        return {
          isLoaded: false,
          isLoading: false,
          isFailed: false,
          isAvailable: false,
          hasCheckedModelStatus: true,
          localModelsDir: "",
          preferredModelSource: null,
        };
      }
    },
  };
});
