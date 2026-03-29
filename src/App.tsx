import { startTransition, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppShell } from "./components/layout/AppShell";
import { DecisionDialog, type DecisionDialogAction } from "./components/layout/DecisionDialog";
import { StartupScreen } from "./screens/StartupScreen";
import { BatchScreen } from "./screens/BatchScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TemplateBuilderScreen } from "./screens/TemplateBuilderScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { TemplatePickerDialog } from "./components/templates/TemplatePickerDialog";
import { useWorkspaceStore } from "./store/workspace";
import type {
  BatchProgressEvent,
  BatchTaskEvent,
  BatchTaskStarted,
  CleanupMethod,
  FileNamingRule,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
  ModelLoadErrorEvent,
  ModelLoadProgressEvent,
  OutputFormat,
  PreviewCache,
  PreviewCacheEntry,
  PreviewResult,
  PreviewTaskEvent,
  PreviewTaskStarted,
  Region,
  SizeHandlingMode,
} from "./types";
import "./styles.css";

type BootstrapState = {
  appName: string;
  appVersion: string;
  platform: string;
  capabilities: string[];
};

type ModelLoadState = {
  isLoaded: boolean;
  isLoading: boolean;
  engine: string;
};

type PreviewRequest = {
  path: string;
  region: Region;
  baseWidth: number;
  baseHeight: number;
  sizeHandlingMode: SizeHandlingMode;
  cleanupMethod: CleanupMethod;
  blurSigma: number;
  fillColor: string;
};

type BatchRequest = {
  paths: string[];
  region: Region;
  baseWidth: number;
  baseHeight: number;
  sizeHandlingMode: SizeHandlingMode;
  cleanupMethod: CleanupMethod;
  blurSigma: number;
  fillColor: string;
  outputDir?: string | null;
  outputFormat: OutputFormat;
  fileNamingRule: FileNamingRule;
  customFileNamingPattern?: string;
  previewCaches: Array<{
    sourcePath: string;
    cachedProcessedPath: string;
    signature: string;
  }>;
};

type DragOverlayState = "idle" | "hover" | "importing";
type PreviewTaskState = {
  taskId: string;
  stage: PreviewTaskEvent["stage"];
  message: string;
};

type DecisionDialogState = {
  title: string;
  description: string;
  cancelAction: DecisionDialogAction;
  primaryAction: DecisionDialogAction;
  secondaryAction?: DecisionDialogAction;
} | null;

type TemplatePickerState = {
  source: "home" | "builder" | "preview" | "batch";
} | null;

const supportedFilters = [
  {
    name: "Images",
    extensions: ["png", "jpg", "jpeg", "webp"],
  },
];

function buildPreviewSignature(params: {
  sourcePath: string;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
}) {
  return JSON.stringify(params);
}

function isPreviewTaskActive(stage?: PreviewTaskEvent["stage"]) {
  return Boolean(stage && stage !== "completed" && stage !== "error");
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function waitForNextTask() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

async function waitForUiCommit() {
  await waitForNextPaint();
  await waitForNextTask();
  await waitForNextPaint();
}

function waitForIdlePeriod(timeout = 3000) {
  return new Promise<void>((resolve) => {
    const idleCallback = (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (typeof idleCallback === "function") {
      idleCallback(() => resolve(), { timeout });
      return;
    }

    window.setTimeout(() => resolve(), Math.min(timeout, 1200));
  });
}

function normalizePaths(paths: string[]) {
  return [...paths].sort().join("::");
}

function logUi(event: string, detail?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (detail) {
    console.info(`[ui][${timestamp}] ${event}`, detail);
    return;
  }
  console.info(`[ui][${timestamp}] ${event}`);
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getScreenMeta(currentScreen: ReturnType<typeof useWorkspaceStore.getState>["navigation"]["currentScreen"]) {
  switch (currentScreen) {
    case "builder":
      return {
        title: "2 调整处理位置",
        subtitle: "选一张样图，框出要处理的地方，再确认怎么适配这批图片。",
      };
    case "preview":
      return {
        title: "3 确认效果",
        subtitle: "先看样图是否正确，确认没问题再开始批量处理。",
      };
    case "batch":
      return {
        title: "4 开始处理",
        subtitle: "看进度、结果和失败项，必要时只重试失败图片。",
      };
    case "templates":
      return {
        title: "常用做法",
        subtitle: "把做过一次的处理方法保存下来，下次直接套用。",
      };
    case "history":
      return {
        title: "处理记录",
        subtitle: "查看上次处理结果，快速复用之前的做法。",
      };
    case "settings":
      return {
        title: "默认设置",
        subtitle: "只放少量常用选项，其他步骤尽量跟着主流程走。",
      };
    default:
      return {
        title: "1 导入图片",
        subtitle: "先导入图片或文件夹，再一步步完成调整、预览和批量处理。",
      };
  }
}

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [dragOverlayState, setDragOverlayState] = useState<DragOverlayState>("idle");
  const [batchProgress, setBatchProgress] = useState<BatchProgressEvent | null>(null);
  const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
  const [previewCacheMap, setPreviewCacheMap] = useState<Record<string, PreviewCacheEntry>>({});
  const [processedCacheMap, setProcessedCacheMap] = useState<Record<string, PreviewCache>>({});
  const [previewTaskStateByImageId, setPreviewTaskStateByImageId] = useState<
    Record<string, PreviewTaskState | undefined>
  >({});
  const [autoPreviewOnEnter, setAutoPreviewOnEnter] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialogState>(null);
  const [templatePicker, setTemplatePicker] = useState<TemplatePickerState>(null);
  const previewTaskContextByTaskIdRef = useRef<
    Record<string, { imageId: string; sourcePath: string; signature: string }>
  >({});
  const previewTaskPromiseRef = useRef<
    Record<string, { resolve: () => void; reject: (error: Error) => void }>
  >({});
  const activeBatchTaskIdRef = useRef<string | null>(null);
  const activeBatchSignatureByPathRef = useRef<Record<string, string>>({});
  const selectedImageIdRef = useRef<string | null>(null);
  const lastImportSignatureRef = useRef("");
  const lastImportAtRef = useRef(0);
  const dragSessionLockedRef = useRef(false);
  const modelWarmupAttemptedRef = useRef(false);

  const {
    navigation,
    appSettings,
    currentTemplateId,
    currentTemplateName,
    isTemplateDirty,
    hasRegionSelection,
    importedImages,
    selectedImageId,
    warnings,
    preview,
    cleanupMethod,
    sizeHandlingMode,
    blurSigma,
    fillColor,
    region,
    outputDir,
    templates,
    history,
    isImporting,
    isPreviewLoading,
    isBatchRunning,
    notification,
    lastBatchResult,
    isModelLoading,
    isModelLoaded,
    isModelFailed,
    modelLoadProgress,
    setCurrentScreen,
    setPendingImportDestination,
    startNewTemplateSession,
    setCurrentTemplateName,
    clearRegionSelection,
    resetCurrentRegionSettings,
    setCleanupMethod,
    setSizeHandlingMode,
    setBlurSigma,
    setFillColor,
    setOutputDir,
    updateRegion,
    resetRegionFromImage,
    setImporting,
    setPreviewLoading,
    setBatchRunning,
    setNotification,
    applyImportSummary,
    appendImportSummary,
    selectImage,
    removeImage,
    clearWorkspace,
    clearPreviewState,
    setPreview,
    setLastBatchResult,
    saveTemplate,
    applyTemplate,
    deleteTemplate,
    addHistory,
    updateAppSettings,
    setModelLoading,
    setModelLoaded,
    setModelFailed,
    setModelLoadProgress,
    preloadModel,
    getModelStatus,
  } = useWorkspaceStore();

  const currentScreen = navigation.currentScreen;
  const selectedImage = importedImages.find((item) => item.id === selectedImageId) ?? null;
  const selectedPreviewTaskState = selectedImage
    ? (previewTaskStateByImageId[selectedImage.id] ?? null)
    : null;
  const isSelectedPreviewTaskRunning = isPreviewTaskActive(selectedPreviewTaskState?.stage);
  const isSelectedImageBusy = isSelectedPreviewTaskRunning;
  const currentPreviewSignature = selectedImage
    ? buildPreviewSignature({
        sourcePath: selectedImage.path,
        region,
        cleanupMethod,
        sizeHandlingMode,
        blurSigma,
        fillColor,
      })
    : "";
  const currentScreenMeta = getScreenMeta(currentScreen);
  const previewStatus = isSelectedImageBusy
    ? "正在生成预览"
    : preview
      ? "预览已就绪"
      : "尚未生成预览";
  const processedPreviewSrc = preview?.processedImagePath ? convertFileSrc(preview.processedImagePath) : null;
  const processedPreviewDisplaySrc = preview?.processedDisplayDataUrl ?? processedPreviewSrc;
  const hasTaskContent =
    importedImages.length > 0 ||
    Boolean(currentTemplateId) ||
    Boolean(currentTemplateName.trim()) ||
    Boolean(preview) ||
    Boolean(lastBatchResult);
  const hasUnsavedTask = isTemplateDirty || importedImages.length > 0;
  const canSaveTemplate = Boolean(currentTemplateName.trim()) && hasRegionSelection;
  const builderPreviewDisabledReason =
    importedImages.length === 0
      ? "请先导入一组图片。"
      : !hasRegionSelection
        ? "请先在样图上框选处理区域。"
        : isSelectedImageBusy
          ? "当前样图正在生成预览，请稍后。"
          : "";
  const canOpenPreview = builderPreviewDisabledReason.length === 0;
  const builderNextActionHint = canOpenPreview
    ? preview
      ? "当前样图预览已就绪，可以进入效果确认；如有改动，进入预览后会自动重新检查。"
      : "先生成一张样图预览，确认效果后再批量处理。"
    : builderPreviewDisabledReason;
  const previewCanStartBatch = !isSelectedImageBusy && Boolean(preview) && !isBatchRunning;
  const previewBatchReadyHint = !selectedImage
    ? "请先选择一张样图。"
    : isSelectedImageBusy
      ? "当前样图正在生成预览，请稍后再开始批量处理。"
      : !preview
        ? "当前样图还没有有效预览，请先重新预览。"
        : isBatchRunning
          ? "当前已有批量任务在运行。"
          : "当前样图预览已就绪，可以开始批量处理。";
  const builderBatchDisabledReason =
    !preview
      ? "请先生成并确认当前样图预览。"
      : !hasRegionSelection
        ? "请先保留有效选区。"
        : isBatchRunning
          ? "当前已有批量任务在运行。"
          : "";

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);

  useEffect(() => {
    if (isPreviewLoading !== isSelectedImageBusy) {
      setPreviewLoading(isSelectedImageBusy);
    }
  }, [isPreviewLoading, isSelectedImageBusy, setPreviewLoading]);

  useEffect(() => {
    document.title = `${currentScreenMeta.title} - 图片批量处理大师`;
  }, [currentScreenMeta.title]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    (
      window as Window & {
        __batchImageStudioStore?: typeof useWorkspaceStore;
      }
    ).__batchImageStudioStore = useWorkspaceStore;
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setBootstrapState({
        appName: "Batch Image Studio",
        appVersion: "web-preview",
        platform: "browser",
        capabilities: [],
      });
      return;
    }

    invoke<BootstrapState>("bootstrap_state")
      .then((state) => {
        logUi("bootstrap:success", {
          platform: state.platform,
          version: state.appVersion,
        });
        setBootstrapState(state);
      })
      .catch((error) => {
        logUi("bootstrap:error", { error: String(error) });
      });
  }, []);

  // 启动页：显示 1.5 秒后自动隐藏，确保快速响应
  useEffect(() => {
    const mountedRef = { current: true };
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setShowStartupScreen(false);
      }
    }, 1500);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // 模型加载事件监听
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const mountedRef = { current: true };
    const unlistenFns: Array<() => void> = [];

    // 监听模型加载进度
    listen<ModelLoadProgressEvent>("model-load:progress", (event) => {
      if (!mountedRef.current) return;
      setModelLoadProgress(event.payload.progress);
      setModelLoading(true);
      setModelFailed(false);
    })
      .then((fn) => unlistenFns.push(fn))
      .catch((error) => {
        console.error("Failed to listen model-load:progress:", error);
      });

    // 监听模型加载完成
    listen("model-load:complete", () => {
      if (!mountedRef.current) return;
      setModelLoaded(true);
      setModelLoading(false);
      setModelFailed(false);
      setModelLoadProgress(100);
      logUi("model:loaded");
    })
      .then((fn) => unlistenFns.push(fn))
      .catch((error) => {
        console.error("Failed to listen model-load:complete:", error);
      });

    // 监听模型加载错误
    listen<ModelLoadErrorEvent>("model-load:error", (event) => {
      if (!mountedRef.current) return;
      setModelLoading(false);
      setModelFailed(true);
      setModelLoaded(false);
      setNotification({
        kind: "error",
        message: `AI 模型加载失败: ${event.payload.error}`,
      });
      logUi("model:error", { error: event.payload.error });
    })
      .then((fn) => unlistenFns.push(fn))
      .catch((error) => {
        console.error("Failed to listen model-load:error:", error);
      });

    return () => {
      mountedRef.current = false;
      unlistenFns.forEach((fn) => fn());
    };
  }, [setModelLoading, setModelLoaded, setModelFailed, setModelLoadProgress, setNotification]);

  // 启动后台模型预加载
  useEffect(() => {
    if (!isTauriRuntime() || modelWarmupAttemptedRef.current) {
      return;
    }

    modelWarmupAttemptedRef.current = true;

    // 延迟启动模型预加载，避免阻塞启动
    const startPreload = async () => {
      try {
        // 先获取当前状态
        const status = await getModelStatus();
        if (status.isLoaded) {
          setModelLoaded(true);
          setModelFailed(false);
          logUi("model:already-loaded");
          return;
        }

        if (status.isLoading) {
          setModelLoading(true);
          return;
        }

        // 启动后台预加载
        logUi("model:preload-start");
        await preloadModel();
      } catch (error) {
        console.error("模型预加载失败:", error);
      }
    };

    // 使用 requestIdleCallback 延迟非关键加载
    const idleCallback = (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (typeof idleCallback === "function") {
      idleCallback(
        () => startPreload(),
        { timeout: 3000 } // 3秒超时保证回调一定会被执行
      );
    } else {
      setTimeout(() => startPreload(), 100);
    }
  }, [getModelStatus, preloadModel, setModelLoading, setModelLoaded, setModelFailed]);

  // 批量处理进度监听
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let mounted = true;
    let unlistenBatch: (() => void) | undefined;
    let unlistenBatchTask: (() => void) | undefined;
    let unlistenPreview: (() => void) | undefined;

    listen<BatchProgressEvent>("batch-progress", (event) => {
      if (!mounted) {
        return;
      }
      setBatchProgress(event.payload);
    })
      .then((fn) => {
        unlistenBatch = fn;
      })
      .catch((error) => {
        console.error("批处理进度监听失败:", error);
      });

    listen<BatchTaskEvent>("batch-task", (event) => {
      if (!mounted) {
        return;
      }

      const payload = event.payload;
      if (activeBatchTaskIdRef.current && payload.taskId !== activeBatchTaskIdRef.current) {
        return;
      }

      switch (payload.stage) {
        case "started":
          setBatchRunning(true);
          break;
        case "completed":
          if (payload.result) {
            const batchResult = payload.result;
            setLastBatchResult(batchResult);
            setProcessedCacheMap((current) => {
              const next = { ...current };
              for (const entry of batchResult.entries) {
                if (!entry.success) {
                  continue;
                }
                const signature = activeBatchSignatureByPathRef.current[entry.sourcePath];
                if (!signature) {
                  continue;
                }
                next[signature] = {
                  sourcePath: entry.sourcePath,
                  cachedProcessedPath: entry.cachedProcessedPath ?? entry.outputPath,
                  signature,
                };
              }
              return next;
            });
            addHistory({
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              importedCount: importedImages.length,
              successCount: batchResult.successCount,
              failedCount: batchResult.failedCount,
              outputDir: batchResult.outputDir,
              cleanupMethod,
              templateId: currentTemplateId ?? undefined,
              templateName: currentTemplateName || undefined,
            });
            setNotification({
              kind: "success",
              message: `批处理完成：共 ${batchResult.processedCount} 张，${batchResult.successCount} 成功，${batchResult.failedCount} 失败。`,
            });
          }
          setBatchRunning(false);
          activeBatchTaskIdRef.current = null;
          break;
        case "cancelled":
          if (payload.result) {
            const batchResult = payload.result;
            setLastBatchResult(batchResult);
            addHistory({
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              importedCount: importedImages.length,
              successCount: batchResult.successCount,
              failedCount: batchResult.failedCount,
              outputDir: batchResult.outputDir,
              cleanupMethod,
              templateId: currentTemplateId ?? undefined,
              templateName: currentTemplateName || undefined,
            });
            setNotification({
              kind: "info",
              message: `批处理已取消：已处理 ${batchResult.processedCount} 张，成功 ${batchResult.successCount}，失败 ${batchResult.failedCount}。`,
            });
          }
          setBatchRunning(false);
          activeBatchTaskIdRef.current = null;
          break;
        case "error":
          setBatchRunning(false);
          setBatchStartedAt(null);
          activeBatchTaskIdRef.current = null;
          setNotification({ kind: "error", message: `批处理失败：${payload.error ?? payload.message}` });
          break;
        default:
          break;
      }
    }).then((fn) => {
      unlistenBatchTask = fn;
    });

    listen<PreviewTaskEvent>("preview-task", (event) => {
      if (!mounted) {
        return;
      }

      const payload = event.payload;
      const context = previewTaskContextByTaskIdRef.current[payload.taskId];
      if (!context) {
        return;
      }

      const isCurrentImage = selectedImageIdRef.current === context.imageId;

      setPreviewTaskStateByImageId((current) => ({
        ...current,
        [context.imageId]: {
          taskId: payload.taskId,
          stage: payload.stage,
          message: payload.message,
        },
      }));

      switch (payload.stage) {
        case "completed":
          if (payload.result) {
            const previewResult = payload.result;
            if (isCurrentImage) {
              setPreview(previewResult);
            }
            setPreviewCacheMap((current) => ({
              ...current,
              [context.signature]: {
                preview: previewResult,
                maskDataUrl: null,
                sourcePath: context.sourcePath,
                signature: context.signature,
              },
            }));
            setProcessedCacheMap((current) => ({
              ...current,
              [context.signature]: {
                sourcePath: context.sourcePath,
                cachedProcessedPath: previewResult.cachedProcessedPath,
                signature: context.signature,
              },
            }));
          }
          previewTaskPromiseRef.current[payload.taskId]?.resolve();
          delete previewTaskPromiseRef.current[payload.taskId];
          delete previewTaskContextByTaskIdRef.current[payload.taskId];
          break;
        case "error":
          previewTaskPromiseRef.current[payload.taskId]?.reject(
            new Error(payload.error ?? payload.message),
          );
          delete previewTaskPromiseRef.current[payload.taskId];
          delete previewTaskContextByTaskIdRef.current[payload.taskId];
          if (isCurrentImage) {
            setNotification({ kind: "error", message: `预览生成失败：${payload.error ?? payload.message}` });
          }
          break;
        default:
          break;
      }
    }).then((fn) => {
      unlistenPreview = fn;
    });

    return () => {
      mounted = false;
      unlistenBatch?.();
      unlistenBatchTask?.();
      unlistenPreview?.();
    };
  }, [
    addHistory,
    cleanupMethod,
    currentTemplateId,
    currentTemplateName,
    importedImages.length,
    setBatchRunning,
    setLastBatchResult,
    setNotification,
    setPreview,
  ]);

  useEffect(() => {
    if (!currentPreviewSignature) {
      return;
    }

    const cached = previewCacheMap[currentPreviewSignature];
    if (cached) {
      setPreview(cached.preview);
      return;
    }

    const processedCache = processedCacheMap[currentPreviewSignature];
    if (!processedCache || !selectedImage) {
      return;
    }

    setPreview({
      processedImagePath: processedCache.cachedProcessedPath,
      processedDisplayDataUrl: "",
      outputWidth: selectedImage.width,
      outputHeight: selectedImage.height,
      cachedProcessedPath: processedCache.cachedProcessedPath,
    });
  }, [currentPreviewSignature, previewCacheMap, processedCacheMap, selectedImage, setPreview]);

  useEffect(() => {
    if (!bootstrapState || modelWarmupAttemptedRef.current || isModelLoaded || isModelLoading) {
      return;
    }

    if (isImporting || isSelectedPreviewTaskRunning || isBatchRunning || dragOverlayState !== "idle") {
      return;
    }

    let cancelled = false;
    modelWarmupAttemptedRef.current = true;

    const warmupInBackground = async () => {
      await waitForIdlePeriod(4000);
      if (cancelled) {
        return;
      }
      await ensureModelReady("preview");
    };

    void warmupInBackground();

    return () => {
      cancelled = true;
    };
  }, [
    bootstrapState,
    dragOverlayState,
    isBatchRunning,
    isImporting,
    isModelLoaded,
    isModelLoading,
    isSelectedPreviewTaskRunning,
  ]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          if (dragSessionLockedRef.current || isImporting) {
            return;
          }
          setDragOverlayState("hover");
          return;
        }

        if (event.payload.type === "drop") {
          dragSessionLockedRef.current = true;
          setDragOverlayState("importing");
          setImporting(true);
          try {
            await waitForUiCommit();
            await importPaths(event.payload.paths);
          } catch (error) {
            setNotification({ kind: "error", message: `拖拽导入失败：${String(error)}` });
          } finally {
            setImporting(false);
            setDragOverlayState("idle");
          }
          return;
        }

        dragSessionLockedRef.current = false;
        setDragOverlayState("idle");
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        setNotification({
          kind: "info",
          message: "当前环境未启用窗口拖拽监听，请使用按钮导入。",
        });
      });

    return () => {
      unlisten?.();
    };
  }, [isImporting, setImporting, setNotification]);

  useEffect(() => {
    if (!autoPreviewOnEnter || currentScreen !== "preview") {
      return;
    }

    if (!selectedImage || isSelectedImageBusy) {
      return;
    }

    const cached = previewCacheMap[currentPreviewSignature] || processedCacheMap[currentPreviewSignature];
    if (cached) {
      setAutoPreviewOnEnter(false);
      return;
    }

    setAutoPreviewOnEnter(false);
    void refreshPreview("auto");
  }, [
    autoPreviewOnEnter,
    currentPreviewSignature,
    currentScreen,
    isSelectedImageBusy,
    previewCacheMap,
    processedCacheMap,
    selectedImage,
  ]);

  async function importPaths(paths: string[], strategy: "replace" | "append" = "replace") {
    const signature = normalizePaths(paths);
    const now = Date.now();
    if (
      signature.length > 0 &&
      signature === lastImportSignatureRef.current &&
      now - lastImportAtRef.current < 1500
    ) {
      return;
    }

    lastImportSignatureRef.current = signature;
    lastImportAtRef.current = now;
    if (strategy === "replace") {
      setBatchProgress(null);
      setBatchStartedAt(null);
      setProcessedCacheMap({});
      setPreviewCacheMap({});
      setPreviewTaskStateByImageId({});
      previewTaskContextByTaskIdRef.current = {};
    }
    const summary = await invoke<ImportSummary>("import_paths", { paths });
    const destination = useWorkspaceStore.getState().navigation.pendingImportDestination;

    startTransition(() => {
      if (strategy === "append") {
        appendImportSummary(summary);
      } else {
        applyImportSummary(summary);
      }

      if (summary.items.length === 0) {
        return;
      }

      setCurrentScreen(destination);
      setAutoPreviewOnEnter(destination === "preview");
    });
  }

  async function importWithDialog(mode: "files" | "folder", strategy: "replace" | "append" = "replace") {
    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持系统文件对话框，请在 Tauri 桌面环境中验证导入流程。",
      });
      return;
    }

    logUi("import-dialog:open", { mode });
    setImporting(true);

    try {
      await waitForUiCommit();
      const selected = await open(
        mode === "folder"
          ? {
              title: "选择图片目录",
              directory: true,
              multiple: false,
              recursive: true,
            }
          : {
              title: "选择图片文件",
              multiple: true,
              filters: supportedFilters,
            },
      );

      if (!selected) {
        return;
      }

      const paths = Array.isArray(selected) ? selected : [selected];
      await waitForUiCommit();
      await importPaths(paths, strategy);
    } catch (error) {
      setNotification({ kind: "error", message: `导入失败：${String(error)}` });
    } finally {
      setImporting(false);
    }
  }

  async function startImportFlow(
    mode: "files" | "folder",
    destination: "builder" | "preview",
    strategy: "replace" | "append" = "replace",
  ) {
    setPendingImportDestination(destination);
    if (destination === "builder" && strategy === "replace") {
      startNewTemplateSession();
    }
    await importWithDialog(mode, strategy);
  }

  async function chooseOutputDir() {
    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持系统目录选择，请在桌面环境中测试。",
      });
      return;
    }

    const selected = await open({
      title: "选择导出目录",
      directory: true,
      multiple: false,
      recursive: true,
    });

    if (selected && !Array.isArray(selected)) {
      setOutputDir(selected);
      setNotification({ kind: "info", message: `导出目录已更新到：${selected}` });
    }
  }

  async function chooseDefaultOutputDir() {
    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持系统目录选择，请在桌面环境中测试。",
      });
      return;
    }

    const selected = await open({
      title: "选择默认输出目录",
      directory: true,
      multiple: false,
      recursive: true,
    });

    if (selected && !Array.isArray(selected)) {
      updateAppSettings({ defaultOutputDir: selected });
      setNotification({ kind: "success", message: `默认输出目录已保存：${selected}` });
    }
  }

  async function ensureModelReady(reason: "preview" | "batch") {
    if (!isTauriRuntime()) {
      return false;
    }

    if (isModelLoaded) {
      return true;
    }

    if (isModelLoading) {
      return false;
    }

    setModelLoading(true);
    setModelLoadProgress(0);
    try {
      if (reason !== "preview") {
        await waitForUiCommit();
      }
      const result = await invoke<ModelLoadState>("preload_model");
      setModelLoadProgress(100);
      if (result.isLoaded) {
        setModelLoaded(true);
      }
      return result.isLoaded;
    } catch {
      return false;
    } finally {
      setModelLoading(false);
    }
  }

  function getSignatureForImage(image: ImportedImage) {
    return buildPreviewSignature({
      sourcePath: image.path,
      region,
      cleanupMethod,
      sizeHandlingMode,
      blurSigma,
      fillColor,
    });
  }

  function hasProcessedCacheForImage(image: ImportedImage) {
    return Boolean(processedCacheMap[getSignatureForImage(image)]);
  }

  async function startPreviewForImage(image: ImportedImage, trigger: "manual" | "auto" | "batch") {
    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持真实预览计算，请在 Tauri 桌面环境中验证。",
      });
      return;
    }

    const signature = getSignatureForImage(image);
    setPreviewTaskStateByImageId((current) => ({
      ...current,
      [image.id]: {
        taskId: current[image.id]?.taskId ?? "",
        stage: "started",
        message: trigger === "batch" ? "正在生成批量预览..." : "正在读取原图...",
      },
    }));

    if (!isModelLoaded && !isModelLoading) {
      await waitForUiCommit();
      await ensureModelReady("preview");
    }

    await waitForUiCommit();
    const started = await invoke<PreviewTaskStarted>("start_preview_task", {
      request: {
        path: image.path,
        region,
        baseWidth: image.width,
        baseHeight: image.height,
        sizeHandlingMode,
        cleanupMethod,
        blurSigma,
        fillColor,
      } satisfies PreviewRequest,
    });
    previewTaskContextByTaskIdRef.current[started.taskId] = {
      imageId: image.id,
      sourcePath: image.path,
      signature,
    };
    const taskPromise = new Promise<void>((resolve, reject) => {
      previewTaskPromiseRef.current[started.taskId] = { resolve, reject };
    });
    setPreviewTaskStateByImageId((current) => ({
      ...current,
      [image.id]: {
        taskId: started.taskId,
        stage: "started",
        message: "预览任务已提交，等待后台处理...",
      },
    }));
    return taskPromise;
  }

  async function refreshPreview(trigger: "manual" | "auto" = "manual") {
    if (!selectedImage || isSelectedImageBusy) {
      return;
    }

    try {
      await startPreviewForImage(selectedImage, trigger);
    } catch (error) {
      setNotification({ kind: "error", message: `预览生成失败：${String(error)}` });
    }
  }

  async function runBatchForPaths(paths: string[]) {
    if (paths.length === 0 || importedImages.length === 0) {
      return;
    }

    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持真实批量执行，请在 Tauri 桌面环境中验证。",
      });
      return;
    }

    setCurrentScreen("batch");
    setBatchRunning(true);
    setBatchStartedAt(Date.now());
    setBatchProgress({
      total: paths.length,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      currentFile: paths[0],
      stage: "started",
    });
    activeBatchSignatureByPathRef.current = Object.fromEntries(
      paths.map((path) => [
        path,
        buildPreviewSignature({
          sourcePath: path,
          region,
          cleanupMethod,
          sizeHandlingMode,
          blurSigma,
          fillColor,
        }),
      ]),
    );
    const previewCaches = paths
      .map((path) => {
        const signature = activeBatchSignatureByPathRef.current[path];
        return signature ? processedCacheMap[signature] : undefined;
      })
      .filter((cache): cache is PreviewCache => Boolean(cache));

    try {
      if (!isModelLoaded && !isModelLoading) {
        await waitForUiCommit();
        await ensureModelReady("batch");
      }
      await waitForUiCommit();
      const started = await invoke<BatchTaskStarted>("start_batch_task", {
        request: {
          paths,
          region,
          baseWidth: selectedImage?.width ?? 1,
          baseHeight: selectedImage?.height ?? 1,
          sizeHandlingMode,
          cleanupMethod,
          blurSigma,
          fillColor,
          outputDir: outputDir || appSettings.defaultOutputDir || null,
          outputFormat: appSettings.defaultFormat ?? "png",
          fileNamingRule: appSettings.defaultFileNamingRule ?? "name_processed",
          customFileNamingPattern: appSettings.customFileNamingPattern?.trim() || undefined,
          previewCaches: previewCaches.map((cache) => ({
            sourcePath: cache.sourcePath,
            cachedProcessedPath: cache.cachedProcessedPath,
            signature: cache.signature,
          })),
        } satisfies BatchRequest,
      });
      activeBatchTaskIdRef.current = started.taskId;
    } catch (error) {
      setBatchProgress(null);
      setBatchStartedAt(null);
      setBatchRunning(false);
      setNotification({ kind: "error", message: `批处理失败：${String(error)}` });
    }
  }

  async function runBatch() {
    // 确保有模板保存，否则历史记录无法复用
    if (!ensureTemplateForBatch()) {
      return;
    }
    await runBatchForPaths(importedImages.map((item) => item.path));
  }

  async function cancelActiveBatchTask() {
    if (!activeBatchTaskIdRef.current) {
      return;
    }

    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持真实批量取消，请在 Tauri 桌面环境中验证。",
      });
      return;
    }

    try {
      await invoke("cancel_batch_task", { taskId: activeBatchTaskIdRef.current });
      setNotification({ kind: "info", message: "正在取消批量任务..." });
    } catch (error) {
      setNotification({ kind: "error", message: `取消批量任务失败：${String(error)}` });
    }
  }

  // 确保有模板保存：如果没有，自动创建临时模板
  function ensureTemplateForBatch(): boolean {
    // 如果已有保存的模板 ID，直接返回
    if (currentTemplateId) {
      return true;
    }

    // 没有保存的模板，自动创建临时模板
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
    const tempName = currentTemplateName.trim() || `临时任务 ${dateStr} ${timeStr}`;

    const saved = saveTemplate(tempName);
    if (!saved) {
      setNotification({
        kind: "error",
        message: "无法创建临时模板，请先配置处理参数。",
      });
      return false;
    }

    // 临时模板已保存，可以继续批量处理
    return true;
  }

  async function openOutputPath(path: string | null | undefined) {
    if (!path) {
      setNotification({ kind: "info", message: "当前没有可打开的输出目录。" });
      return;
    }

    if (!isTauriRuntime()) {
      setNotification({
        kind: "info",
        message: "浏览器预览环境不支持打开系统文件管理器，请在 Tauri 桌面环境中验证。",
      });
      return;
    }

    try {
      await invoke("open_path_in_file_manager", { path });
    } catch (error) {
      setNotification({ kind: "error", message: `打开目录失败：${String(error)}` });
    }
  }

  async function retryFailedOnly() {
    const failedPaths =
      lastBatchResult?.entries.filter((entry) => !entry.success).map((entry) => entry.sourcePath) ?? [];
    await runBatchForPaths(failedPaths);
  }

  function saveCurrentTemplate() {
    const name = currentTemplateName || window.prompt("模板名称") || "";
    const saved = saveTemplate(name.trim());
    if (!saved) {
      return;
    }
    setNotification({ kind: "success", message: `模板已保存：${saved.name}` });
  }

  async function handleUseTemplate(templateId: string) {
    setTemplatePicker(null);
    if (hasTaskContent) {
      setDecisionDialog({
        title: "应用新模板到当前任务？",
        description:
          "你可以将新模板应用到当前已导入图片，也可以清空当前任务后重新开始。已有预览结果会被清除。",
        secondaryAction: {
          label: "取消",
          tone: "neutral",
          onClick: closeDecisionDialog,
        },
        cancelAction: {
          label: "应用到当前图片",
          tone: "neutral",
          onClick: () => {
            applyTemplate(templateId);
            setCurrentScreen("builder");
            setDecisionDialog(null);
            setNotification({ kind: "success", message: "已应用新模板，请重新预览效果。" });
          },
        },
        primaryAction: {
          label: "清空任务后应用",
          tone: "primary",
          onClick: () => {
            clearWorkspace();
            applyTemplate(templateId);
            setCurrentScreen("builder");
            setDecisionDialog(null);
            setNotification({ kind: "success", message: "模板已应用，现在可以导入图片或调整参数。" });
          },
        },
      });
      return;
    }

    applyTemplate(templateId);
    setCurrentScreen("builder");
    setNotification({ kind: "success", message: "模板已应用，现在可以导入图片或调整参数。" });
  }

  function applyTemplateToCurrentTask(templateId: string) {
    setTemplatePicker(null);
    applyTemplate(templateId);
    setCurrentScreen("builder");
    setNotification({ kind: "success", message: "已应用新模板，请重新预览效果。" });
  }

  function clearTaskThenApplyTemplate(templateId: string) {
    setTemplatePicker(null);
    clearWorkspace();
    applyTemplate(templateId);
    setCurrentScreen("builder");
    setNotification({ kind: "success", message: "模板已应用，现在可以导入图片或调整参数。" });
  }

  function handleEditTemplate(templateId: string) {
    applyTemplate(templateId);
    setCurrentScreen("builder");
  }

  async function handleReuseHistory(entry: HistoryEntry) {
    if (entry.templateId) {
      await handleUseTemplate(entry.templateId);
      return;
    }

    setNotification({
      kind: "info",
      message: "该历史记录没有绑定模板，将打开模板中心供你重新选择。",
    });
    setCurrentScreen("templates");
  }

  function handleNotificationClose() {
    setNotification(null);
  }

  function closeDecisionDialog() {
    setDecisionDialog(null);
  }

  function closeTemplatePicker() {
    setTemplatePicker(null);
  }

  function clearTaskAndGoHome() {
    clearWorkspace();
    setCurrentScreen("home");
    setDecisionDialog(null);
  }

  function clearPreviewAndReturnToBuilder() {
    clearPreviewState();
    setCurrentScreen("builder");
    setDecisionDialog(null);
    setNotification({ kind: "info", message: "已放弃当前预览，模板配置和图片仍然保留。" });
  }

  function navigateWithGuard(nextScreen: typeof currentScreen) {
    if (currentScreen === "builder" && nextScreen === "home" && hasUnsavedTask) {
      setDecisionDialog({
        title: "离开当前任务？",
        description: "当前任务还有未保存内容。你可以继续编辑，或清空当前任务后返回首页。",
        cancelAction: {
          label: "继续编辑",
          tone: "neutral",
          onClick: closeDecisionDialog,
        },
        primaryAction: {
          label: "清空并返回首页",
          tone: "danger",
          onClick: clearTaskAndGoHome,
        },
      });
      return;
    }

    setCurrentScreen(nextScreen);
  }

  function handlePreviewEntry() {
    if (!hasRegionSelection) {
      setNotification({ kind: "info", message: "当前没有选区，请先框选处理区域。" });
      return;
    }
    setCurrentScreen("preview");
    setAutoPreviewOnEnter(true);
  }

  function handlePreviewSelectImage(id: string) {
    selectImage(id);
    setAutoPreviewOnEnter(true);
  }

  function handleRemoveSelectedImage() {
    if (!selectedImage) {
      return;
    }

    if (importedImages.length <= 1) {
      setDecisionDialog({
        title: "移除最后一张图片？",
        description: "当前任务将没有图片。移除后会清空当前任务并返回首页。",
        cancelAction: {
          label: "取消",
          tone: "neutral",
          onClick: closeDecisionDialog,
        },
        primaryAction: {
          label: "移除并返回首页",
          tone: "danger",
          onClick: clearTaskAndGoHome,
        },
      });
      return;
    }

    useWorkspaceStore.getState().removeImage(selectedImage.id);
  }

  function handleRemoveImage(imageId: string) {
    const image = importedImages.find((item) => item.id === imageId);
    if (!image) {
      return;
    }

    if (importedImages.length <= 1) {
      setDecisionDialog({
        title: "移除最后一张图片？",
        description: "当前任务将没有图片。移除后会清空当前任务并返回首页。",
        cancelAction: {
          label: "取消",
          tone: "neutral",
          onClick: closeDecisionDialog,
        },
        primaryAction: {
          label: "移除并返回首页",
          tone: "danger",
          onClick: clearTaskAndGoHome,
        },
      });
      return;
    }

    removeImage(imageId);
  }

  const notificationNode = notification || warnings.length > 0 ? (
    <div className="space-y-3">
      {notification ? (
        <section
          className={`rounded-2xl border p-4 text-sm ${
            notification.kind === "error"
              ? "border-[#f1c6c6] bg-[#fff1f1] text-[#9a2020]"
              : notification.kind === "success"
                ? "border-[#cde8d6] bg-[#f0faf4] text-[#17603a]"
                : "border-line bg-[#f6f8fb] text-muted"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <p>{notification.message}</p>
            <button className="text-xs underline underline-offset-2" type="button" onClick={handleNotificationClose}>
              关闭
            </button>
          </div>
        </section>
      ) : null}
      {warnings.length > 0 ? (
        <section className="rounded-2xl border border-[#f0d8a8] bg-[#fff6df] p-4">
          <p className="text-sm font-medium text-warning">导入提醒</p>
          <ul className="mt-2 space-y-1 text-sm text-[#8a5b00]">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  ) : null;

  const shellActions =
    currentScreen === "home" ? (
      <>
        <button
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white"
          type="button"
          disabled={isImporting}
          onClick={() => void startImportFlow("files", "builder", "replace")}
        >
          导入图片
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          disabled={isImporting}
          onClick={() => void startImportFlow("folder", "builder", "replace")}
        >
          导入文件夹
        </button>
      </>
    ) : currentScreen === "builder" ? (
      <>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          disabled={isImporting}
          onClick={() => void startImportFlow("files", "builder", importedImages.length > 0 ? "append" : "replace")}
        >
          {importedImages.length > 0 ? "追加图片" : "导入图片"}
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          disabled={isImporting}
          onClick={() => void startImportFlow("folder", "builder", importedImages.length > 0 ? "append" : "replace")}
        >
          {importedImages.length > 0 ? "追加文件夹" : "导入文件夹"}
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={importedImages.length === 0}
          onClick={() =>
            setDecisionDialog({
              title: "清空当前任务？",
              description: "清空后将移除当前导入的图片、预览结果和未保存的编辑内容，并返回首页。",
              cancelAction: {
                label: "取消",
                tone: "neutral",
                onClick: closeDecisionDialog,
              },
              primaryAction: {
                label: "清空并返回首页",
                tone: "danger",
                onClick: clearTaskAndGoHome,
              },
            })
          }
        >
          清空任务
        </button>
      </>
    ) : currentScreen === "preview" ? (
      <>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => {
            // 防抖：如果对话框已经显示，不重复触发
            if (decisionDialog) {
              return;
            }
            if (preview) {
              setDecisionDialog({
                title: "放弃预览？",
                description: "预览将被放弃，返回调整区域。",
                cancelAction: {
                  label: "取消",
                  tone: "neutral",
                  onClick: closeDecisionDialog,
                },
                primaryAction: {
                  label: "确认返回",
                  tone: "danger", // 改为 danger 表示丢失数据的操作
                  onClick: () => {
                    clearPreviewState();
                    setCurrentScreen("builder");
                    setDecisionDialog(null);
                  },
                },
              });
            } else {
              setCurrentScreen("builder");
            }
          }}
        >
          返回调整
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={!selectedImage || isSelectedImageBusy}
          onClick={() => void refreshPreview("manual")}
        >
          重新预览
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() =>
            setDecisionDialog({
              title: "放弃当前预览？",
              description: "这会清除当前预览结果，但不会删除导入图片、区域设置或模板内容。",
              cancelAction: {
                label: "继续查看",
                tone: "neutral",
                onClick: closeDecisionDialog,
              },
              primaryAction: {
                label: "放弃预览",
                tone: "danger",
                onClick: clearPreviewAndReturnToBuilder,
              },
            })
          }
        >
          放弃当前预览
        </button>
      </>
    ) : currentScreen === "batch" ? (
      <>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => navigateWithGuard("home")}
        >
          返回首页
        </button>
      </>
    ) : undefined;

  let content = (
    <HomeScreen
      templates={templates}
      history={history}
      isImporting={isImporting}
      isModelLoaded={isModelLoaded}
      isModelLoading={isModelLoading}
      isModelFailed={isModelFailed}
      modelLoadProgress={modelLoadProgress}
      onImportFiles={() => void startImportFlow("files", "builder", "replace")}
      onImportFolder={() => void startImportFlow("folder", "builder", "replace")}
      onOpenTemplates={() => setTemplatePicker({ source: "home" })}
      onUseTemplate={(id) => void handleUseTemplate(id)}
      onOpenHistory={() => setCurrentScreen("history")}
      onRetryModelLoad={async () => {
        try {
          await preloadModel();
        } catch (error) {
          console.error("重试模型加载失败:", error);
        }
      }}
    />
  );

  if (currentScreen === "builder") {
    content = (
      <TemplateBuilderScreen
        importedImages={importedImages}
        selectedImage={selectedImage}
        selectedImageId={selectedImageId}
        previewTaskStateByImageId={previewTaskStateByImageId}
        region={region}
        cleanupMethod={cleanupMethod}
        sizeHandlingMode={sizeHandlingMode}
        blurSigma={blurSigma}
        fillColor={fillColor}
        outputDir={outputDir}
        currentTemplateName={currentTemplateName}
        isTemplateDirty={isTemplateDirty}
        hasRegionSelection={hasRegionSelection}
        previewReady={Boolean(preview)}
        isPreviewBusy={isSelectedImageBusy}
        canSaveTemplate={canSaveTemplate}
        canOpenPreview={canOpenPreview}
        nextActionLabel={preview ? "查看预览" : "生成预览"}
        nextActionHint={builderNextActionHint}
        onSelectImage={selectImage}
        onUpdateRegion={updateRegion}
        onSetCleanupMethod={setCleanupMethod}
        onSetSizeHandlingMode={setSizeHandlingMode}
        onSetBlurSigma={setBlurSigma}
        onSetFillColor={setFillColor}
        onSetOutputDir={setOutputDir}
        onChooseOutputDir={() => void chooseOutputDir()}
        onSetCurrentTemplateName={setCurrentTemplateName}
        onResetRegion={() => resetRegionFromImage(selectedImage)}
        onClearRegionSelection={() => {
          clearRegionSelection();
          setNotification({ kind: "info", message: "当前没有选区，请重新框选。" });
        }}
        onResetCurrentRegionSettings={() => {
          resetCurrentRegionSettings();
          setNotification({ kind: "success", message: "当前区域设置已恢复默认。" });
        }}
        onImportFiles={() =>
          void startImportFlow("files", "builder", importedImages.length > 0 ? "append" : "replace")
        }
        onImportFolder={() =>
          void startImportFlow("folder", "builder", importedImages.length > 0 ? "append" : "replace")
        }
        onClearWorkspace={() =>
          setDecisionDialog({
            title: "清空当前任务？",
            description: "清空后将移除当前导入的图片、预览结果和未保存的编辑内容，并返回首页。",
            cancelAction: {
              label: "取消",
              tone: "neutral",
              onClick: closeDecisionDialog,
            },
            primaryAction: {
              label: "清空并返回首页",
              tone: "danger",
              onClick: clearTaskAndGoHome,
            },
          })
        }
        onRemoveSelectedImage={handleRemoveSelectedImage}
        onRemoveImage={handleRemoveImage}
        onOpenTemplates={() => setTemplatePicker({ source: "builder" })}
        onSaveTemplate={saveCurrentTemplate}
        onOpenPreview={handlePreviewEntry}
      />
    );
  } else if (currentScreen === "preview") {
    content = (
      <PreviewScreen
        importedImages={importedImages}
        selectedImageId={selectedImageId}
        selectedImage={selectedImage}
        previewTaskStateByImageId={previewTaskStateByImageId}
        beforeSrc={selectedImage?.thumbnailDataUrl ?? null}
        afterSrc={processedPreviewDisplaySrc}
        currentTemplateName={currentTemplateName}
        cleanupMethod={cleanupMethod}
        sizeHandlingMode={sizeHandlingMode}
        previewStatus={previewStatus}
        loadingMessage={selectedPreviewTaskState?.message}
        canStartBatch={previewCanStartBatch}
        batchReadyHint={previewBatchReadyHint}
        onSelectImage={handlePreviewSelectImage}
        onOpenTemplates={() => setTemplatePicker({ source: "preview" })}
        onStartBatch={() => void runBatch()}
        onBackToBuilder={() => setCurrentScreen("builder")}
      />
    );
  } else if (currentScreen === "batch") {
    content = (
      <BatchScreen
        importedImages={importedImages}
        progress={batchProgress}
        startedAt={batchStartedAt}
        result={lastBatchResult}
        onRetryFailedOnly={() => void retryFailedOnly()}
        onBackHome={() => setCurrentScreen("home")}
        onOpenOutputDir={() => void openOutputPath(lastBatchResult?.outputDir)}
        onCancelBatch={() => void cancelActiveBatchTask()}
        isBatchRunning={isBatchRunning}
        onSwitchTemplate={() => setTemplatePicker({ source: "batch" })}
      />
    );
  } else if (currentScreen === "templates") {
    content = (
      <TemplatesScreen
        templates={templates}
        onApply={(id) => void handleUseTemplate(id)}
        onEdit={handleEditTemplate}
        onDelete={(id) => {
          deleteTemplate(id);
          setNotification({ kind: "success", message: "模板已删除。" });
        }}
        onCreateNew={() => {
          startNewTemplateSession();
          clearWorkspace();
          setCurrentScreen("builder");
        }}
      />
    );
  } else if (currentScreen === "history") {
    content = (
      <HistoryScreen
        history={history}
        onReuse={(entry) => void handleReuseHistory(entry)}
        onOpenOutputDir={(entry) => void openOutputPath(entry.outputDir)}
      />
    );
  } else if (currentScreen === "settings") {
    content = (
      <SettingsScreen
        appSettings={appSettings}
        onUpdateSettings={updateAppSettings}
        onChooseDefaultOutputDir={() => void chooseDefaultOutputDir()}
      />
    );
  }

  return (
    <>
      {/* 启动页 - 应用启动时显示，快速过渡到主界面 */}
      {showStartupScreen && <StartupScreen />}

      {/* 主应用界面 */}
      {!showStartupScreen && (
        <div
          className={dragOverlayState === "hover" ? "ring-4 ring-primary/20" : ""}
        >
          {dragOverlayState === "hover" ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-6">
          <div className="rounded-full border border-primary/25 bg-white/96 px-5 py-3 shadow-ambient backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-sm font-medium text-primary-strong">松手即可导入图片或文件夹</p>
            </div>
          </div>
        </div>
      ) : null}

      {(dragOverlayState === "importing" || isImporting) && currentScreen !== "home" ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-white/12 pt-10">
          <div className="rounded-2xl border border-primary/20 bg-white/96 px-5 py-3 shadow-ambient backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <div>
                <p className="text-sm font-medium text-primary-strong">正在导入图片</p>
                <p className="text-xs text-muted">正在读取文件与生成缩略图</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AppShell
        currentScreen={currentScreen}
        onNavigate={navigateWithGuard}
        title={currentScreenMeta.title}
        subtitle={
          bootstrapState ? `${currentScreenMeta.subtitle} · ${bootstrapState.platform} · ${bootstrapState.appVersion}` : currentScreenMeta.subtitle
        }
        actions={shellActions}
        notification={notificationNode}
      >
        {content}
      </AppShell>
      {decisionDialog ? (
        <DecisionDialog
          title={decisionDialog.title}
          description={decisionDialog.description}
          cancelAction={decisionDialog.cancelAction}
          secondaryAction={decisionDialog.secondaryAction}
          primaryAction={decisionDialog.primaryAction}
        />
      ) : null}
      {templatePicker ? (
        <TemplatePickerDialog
          templates={templates}
          title={templatePicker.source === "builder" ? "切换模板" : "应用已有模板"}
          description={
            templatePicker.source === "builder"
              ? "直接选择一个模板应用到当前任务，也可以进入模板中心进行管理。"
              : "先选择模板，再进入模板构建页查看参数并导入图片。"
          }
          mode={templatePicker.source === "builder" && hasTaskContent ? "task-switch" : "simple"}
          onSelect={(id) => void handleUseTemplate(id)}
          onApplyToCurrent={(id) => applyTemplateToCurrentTask(id)}
          onClearThenApply={(id) => clearTaskThenApplyTemplate(id)}
          onManageTemplates={() => {
            setTemplatePicker(null);
            setCurrentScreen("templates");
          }}
          onClose={closeTemplatePicker}
        />
      ) : null}
        </div>
      )}
    </>
  );
}
