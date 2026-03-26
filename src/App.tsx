import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppShell } from "./components/layout/AppShell";
import { DecisionDialog, type DecisionDialogAction } from "./components/layout/DecisionDialog";
import { BatchScreen } from "./screens/BatchScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TemplateBuilderScreen } from "./screens/TemplateBuilderScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { useWorkspaceStore } from "./store/workspace";
import type {
  BatchProgressEvent,
  BatchTaskEvent,
  BatchTaskStarted,
  CleanupMethod,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
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
        title: "模板构建",
        subtitle: "在样图上框选区域，配置处理方式并保存模板。",
      };
    case "preview":
      return {
        title: "效果预览",
        subtitle: "确认样张效果，避免直接批量处理带来风险。",
      };
    case "batch":
      return {
        title: "批量执行",
        subtitle: "查看当前任务进度、失败项和输出结果。",
      };
    case "templates":
      return {
        title: "模板中心",
        subtitle: "集中管理可复用模板，快速应用到相似图片。",
      };
    case "history":
      return {
        title: "历史记录",
        subtitle: "找到之前做过的任务并再次使用对应模板。",
      };
    case "settings":
      return {
        title: "设置",
        subtitle: "管理默认输出目录、格式和应用级默认项。",
      };
    default:
      return {
        title: "首页",
        subtitle: "从导入开始，完成模板构建、预览与批量处理。",
      };
  }
}

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
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
    setModelLoadProgress,
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
    if (strategy === "append") {
      appendImportSummary(summary);
    } else {
      applyImportSummary(summary);
    }
    if (summary.items.length === 0) {
      return;
    }

    const destination = useWorkspaceStore.getState().navigation.pendingImportDestination;
    setCurrentScreen(destination);
    setAutoPreviewOnEnter(destination === "preview");
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
          previewCaches: Object.values(processedCacheMap).map((cache) => ({
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
    await runBatchForPaths(importedImages.map((item) => item.path));
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
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          disabled={!currentTemplateName.trim() || !hasRegionSelection}
          onClick={saveCurrentTemplate}
        >
          保存模板
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
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={importedImages.length === 0 || !hasRegionSelection || isSelectedImageBusy}
          onClick={handlePreviewEntry}
        >
          预览效果
        </button>
        <button
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={!preview || !hasRegionSelection || isBatchRunning}
          onClick={() => void runBatch()}
        >
          开始批量处理
        </button>
      </>
    ) : currentScreen === "preview" ? (
      <>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => navigateWithGuard("builder")}
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
          disabled={importedImages.length === 0}
          onClick={saveCurrentTemplate}
        >
          保存模板
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
        <button
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={!selectedImage || isSelectedImageBusy || isBatchRunning}
          onClick={() => void runBatch()}
        >
          开始批量处理
        </button>
      </>
    ) : currentScreen === "batch" ? (
      <>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={!lastBatchResult?.outputDir}
          onClick={() => void openOutputPath(lastBatchResult?.outputDir)}
        >
          打开输出目录
        </button>
        <button
          className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={!lastBatchResult || lastBatchResult.failedCount === 0}
          onClick={() => void retryFailedOnly()}
        >
          仅重试失败项
        </button>
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
      onImportFiles={() => void startImportFlow("files", "builder", "replace")}
      onImportFolder={() => void startImportFlow("folder", "builder", "replace")}
      onOpenTemplates={() => setCurrentScreen("templates")}
      onUseTemplate={(id) => void handleUseTemplate(id)}
      onOpenHistory={() => setCurrentScreen("history")}
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
        onOpenTemplates={() => setCurrentScreen("templates")}
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
        onSelectImage={handlePreviewSelectImage}
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
    </div>
  );
}
