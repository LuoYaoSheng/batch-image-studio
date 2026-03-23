import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWorkspaceStore } from "./store/workspace";
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
} from "./types";

type BootstrapState = {
  appName: string;
  appVersion: string;
  platform: string;
  capabilities: string[];
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
};

const supportedFilters = [
  {
    name: "Images",
    extensions: ["png", "jpg", "jpeg", "webp"],
  },
];

const cleanupPresets: Array<{
  id: string;
  label: string;
  detail: string;
  cleanupMethod: CleanupMethod;
  blurSigma: number;
  region: Region;
  fillColor: string;
}> = [
  {
    id: "doubao-default",
    label: "豆包默认水印",
    detail: "针对豆包 AI 常见右下角标识的第一版规则。",
    cleanupMethod: "blur",
    blurSigma: 12,
    region: { x: 0.72, y: 0.8, width: 0.22, height: 0.12 },
    fillColor: "#f7f9fc",
  },
  {
    id: "doubao-wide",
    label: "豆包宽水印",
    detail: "适合底边更宽、占据横向空间较大的豆包标识。",
    cleanupMethod: "crop",
    blurSigma: 8,
    region: { x: 0.0, y: 0.9, width: 1, height: 0.1 },
    fillColor: "#f7f9fc",
  },
  {
    id: "doubao-light-bg",
    label: "豆包浅底图",
    detail: "适合浅色背景上的豆包角落文字。",
    cleanupMethod: "fill",
    blurSigma: 6,
    region: { x: 0.68, y: 0.76, width: 0.24, height: 0.14 },
    fillColor: "#ffffff",
  },
];

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function clampPercent(value: number) {
  return Math.max(0.01, Math.min(0.98, value));
}

function clampRegion(region: Region): Region {
  const width = clampPercent(region.width);
  const height = clampPercent(region.height);
  const x = Math.max(0, Math.min(1 - width, region.x));
  const y = Math.max(0, Math.min(1 - height, region.y));

  return { x, y, width, height };
}

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function parsePercentInput(value: string) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return clampPercent(numeric / 100);
}

function getContainedRect(
  bounds: { width: number; height: number },
  dimensions?: { width: number; height: number },
) {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const imageAspect = dimensions.width / dimensions.height;
  const frameAspect = bounds.width / bounds.height;

  if (imageAspect > frameAspect) {
    const width = bounds.width;
    const height = width / imageAspect;
    return {
      left: 0,
      top: (bounds.height - height) / 2,
      width,
      height,
    };
  }

  const height = bounds.height;
  const width = height * imageAspect;
  return {
    left: (bounds.width - width) / 2,
    top: 0,
    width,
    height,
  };
}

function RegionSliders({
  region,
  onChange,
}: {
  region: Region;
  onChange: (patch: Partial<Region>) => void;
}) {
  const controls: Array<{ key: keyof Region; label: string; min: number; max: number; step: number }> = [
    { key: "x", label: "X 起点", min: 0, max: 0.95, step: 0.01 },
    { key: "y", label: "Y 起点", min: 0, max: 0.95, step: 0.01 },
    { key: "width", label: "宽度", min: 0.02, max: 0.98, step: 0.01 },
    { key: "height", label: "高度", min: 0.02, max: 0.98, step: 0.01 },
  ];

  return (
    <div className="space-y-4">
      {controls.map((control) => (
        <label key={control.key} className="block">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{control.label}</span>
            <span className="font-mono text-xs text-muted">
              {formatPercent(region[control.key])}%
            </span>
          </div>
          <input
            className="w-full accent-primary"
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={region[control.key]}
            onChange={(event) =>
              onChange({
                [control.key]: clampPercent(Number(event.target.value)),
              } as Partial<Region>)
            }
          />
        </label>
      ))}
    </div>
  );
}

function RegionInputs({
  region,
  onChange,
}: {
  region: Region;
  onChange: (patch: Partial<Region>) => void;
}) {
  const fields: Array<{ key: keyof Region; label: string }> = [
    { key: "x", label: "X%" },
    { key: "y", label: "Y%" },
    { key: "width", label: "W%" },
    { key: "height", label: "H%" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <label key={field.key} className="block">
          <span className="mb-2 block text-xs font-medium text-muted">{field.label}</span>
          <input
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            type="number"
            min={1}
            max={98}
            step={1}
            value={formatPercent(region[field.key])}
            onChange={(event) => {
              const next = parsePercentInput(event.target.value);
              if (next === null) {
                return;
              }
              onChange({ [field.key]: next } as Partial<Region>);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function PreviewCard({
  title,
  image,
  region,
  selected,
  dimensions,
  editable = false,
  onRegionChange,
}: {
  title: string;
  image: string | null;
  region?: Region;
  selected?: boolean;
  dimensions?: { width: number; height: number };
  editable?: boolean;
  onRegionChange?: (patch: Partial<Region>) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 320 });
  const contained = getContainedRect(frameSize, dimensions);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateSize = () => {
      const bounds = frame.getBoundingClientRect();
      setFrameSize({ width: bounds.width, height: bounds.height });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  function locatePointer(clientX: number, clientY: number) {
    const frame = frameRef.current;
    if (!frame || !region) {
      return null;
    }

    const bounds = frame.getBoundingClientRect();
    const relativeX = clientX - bounds.left;
    const relativeY = clientY - bounds.top;

    if (
      relativeX < contained.left ||
      relativeX > contained.left + contained.width ||
      relativeY < contained.top ||
      relativeY > contained.top + contained.height
    ) {
      return null;
    }

    const x = (relativeX - contained.left) / contained.width;
    const y = (relativeY - contained.top) / contained.height;

    return clampRegion({
      x: x - region.width / 2,
      y: y - region.height / 2,
      width: region.width,
      height: region.height,
    });
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable || !region || !onRegionChange) {
      return;
    }

    const next = locatePointer(event.clientX, event.clientY);
    if (!next) {
      return;
    }

    onRegionChange(next);
  }

  function startRegionInteraction(
    event: React.PointerEvent<HTMLDivElement>,
    mode: "move" | "resize-right" | "resize-bottom" | "resize-corner",
  ) {
    if (!editable || !region || !onRegionChange || !frameRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const bounds = frameRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialRegion = region;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / contained.width;
      const dy = (moveEvent.clientY - startY) / contained.height;
      if (mode === "move") {
        onRegionChange(
          clampRegion({
            x: initialRegion.x + dx,
            y: initialRegion.y + dy,
            width: initialRegion.width,
            height: initialRegion.height,
          }),
        );
        return;
      }

      const nextWidth =
        mode === "resize-bottom"
          ? initialRegion.width
          : Math.max(0.02, Math.min(1 - initialRegion.x, initialRegion.width + dx));
      const nextHeight =
        mode === "resize-right"
          ? initialRegion.height
          : Math.max(0.02, Math.min(1 - initialRegion.y, initialRegion.height + dy));

      onRegionChange(
        clampRegion({
          x: initialRegion.x,
          y: initialRegion.y,
          width: nextWidth,
          height: nextHeight,
        }),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <section className="rounded-[24px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
          {title}
        </h3>
        {dimensions ? (
          <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-muted">
            {dimensions.width} × {dimensions.height}
          </span>
        ) : null}
      </div>

      <div
        ref={frameRef}
        className={`relative mt-4 overflow-hidden rounded-[20px] border border-line bg-white ${
          editable ? "cursor-crosshair" : ""
        }`}
        onPointerDown={handleCanvasPointerDown}
      >
        {image ? (
          <img alt={title} className="h-[320px] w-full object-contain" src={image} />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted">
            暂无图像
          </div>
        )}
        {image && region && selected ? (
          <div
            className={`absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,72,141,0.14)] ${
              editable ? "cursor-move" : "pointer-events-none"
            }`}
            style={{
              left: `${contained.left + region.x * contained.width}px`,
              top: `${contained.top + region.y * contained.height}px`,
              width: `${region.width * contained.width}px`,
              height: `${region.height * contained.height}px`,
            }}
            onPointerDown={(event) => startRegionInteraction(event, "move")}
          >
            {editable ? (
              <>
                <div
                  className="absolute -right-1 top-1/2 h-12 w-3 -translate-y-1/2 rounded-full bg-primary/90"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-right")}
                />
                <div
                  className="absolute bottom-0 left-1/2 h-3 w-12 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/90"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-bottom")}
                />
                <div
                  className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-primary"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-corner")}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {editable ? (
        <p className="mt-3 text-xs text-muted">
          点击预览图可快速定位，拖动蓝色框可移动；右边、下边和右下角手柄可直接缩放区域。
        </p>
      ) : null}
    </section>
  );
}

function ComparePreview({
  sourceImage,
  processedImage,
  slider,
  onSliderChange,
}: {
  sourceImage: string | null;
  processedImage: string | null;
  slider: number;
  onSliderChange: (value: number) => void;
}) {
  return (
    <section className="rounded-[24px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
          前后对比
        </h3>
        <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-muted">
          {slider}%
        </span>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-line bg-white">
        {sourceImage && processedImage ? (
          <div className="relative h-[320px]">
            <img alt="before" className="absolute inset-0 h-full w-full object-contain" src={sourceImage} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${slider}%` }}
            >
              <img alt="after" className="h-full w-full object-contain" src={processedImage} />
            </div>
            <div
              className="absolute inset-y-0 w-0.5 bg-primary"
              style={{ left: `${slider}%` }}
            />
          </div>
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted">
            生成样张后可拖动滑杆比较前后差异。
          </div>
        )}
      </div>

      <input
        className="mt-4 w-full accent-primary"
        type="range"
        min={5}
        max={95}
        step={1}
        value={slider}
        onChange={(event) => onSliderChange(Number(event.target.value))}
      />
    </section>
  );
}

function ImageList({
  items,
  selectedImageId,
  onSelect,
}: {
  items: ImportedImage[];
  selectedImageId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.id}
          className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition ${
            selectedImageId === item.id
              ? "border-primary bg-primary/8"
              : "border-line bg-white hover:border-primary-strong"
          }`}
          type="button"
          onClick={() => onSelect(item.id)}
        >
          <img
            alt={item.name}
            className="h-16 w-16 rounded-xl border border-line object-cover"
            src={item.thumbnailDataUrl}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="mt-1 text-xs text-muted">
              {item.width} × {item.height} · {item.format.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted">{formatBytes(item.fileSize)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function TemplatesPanel({
  templates,
  onApply,
  onSave,
}: {
  templates: Template[];
  onApply: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
          模板
        </h3>
        <button
          className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium"
          type="button"
          onClick={onSave}
        >
          保存当前参数
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {templates.length === 0 ? (
          <p className="text-sm text-muted">还没有保存的模板。</p>
        ) : (
          templates.map((template) => (
            <button
              key={template.id}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm hover:border-primary-strong"
              type="button"
              onClick={() => onApply(template.id)}
            >
              <span>{template.name}</span>
              <span className="font-mono text-xs text-muted">{template.cleanupMethod}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function HistoryPanel({ history }: { history: HistoryEntry[] }) {
  return (
    <section className="rounded-[24px] border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
        历史任务
      </h3>
      <div className="mt-4 space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-muted">首轮批处理完成后会在这里留下结果。</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.cleanupMethod.toUpperCase()}</p>
                <p className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <p className="mt-2 text-sm text-muted">
                {item.successCount}/{item.importedCount} 成功，失败 {item.failedCount}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{item.outputDir}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [compareSlider, setCompareSlider] = useState(50);
  const [isDragActive, setIsDragActive] = useState(false);
  const {
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
    setCleanupMethod,
    setSizeHandlingMode,
    setBlurSigma,
    setFillColor,
    setOutputDir,
    updateRegion,
    setImporting,
    setPreviewLoading,
    setBatchRunning,
    setNotification,
    applyImportSummary,
    selectImage,
    removeImage,
    clearWorkspace,
    setPreview,
    setLastBatchResult,
    saveTemplate,
    applyTemplate,
    addHistory,
  } = useWorkspaceStore();

  const selectedImage = importedImages.find((item) => item.id === selectedImageId) ?? null;
  const regionPixels = selectedImage
    ? {
        x: Math.round(region.x * selectedImage.width),
        y: Math.round(region.y * selectedImage.height),
        width: Math.round(region.width * selectedImage.width),
        height: Math.round(region.height * selectedImage.height),
      }
    : null;
  const workflowStage = isBatchRunning
    ? "batch_running"
    : isPreviewLoading
      ? "preview_loading"
      : lastBatchResult
        ? "batch_complete"
        : preview
          ? "preview_ready"
          : importedImages.length > 0
            ? "images_loaded"
            : "empty";
  const workflowLabel = {
    empty: "等待导入",
    images_loaded: "已导入，可生成预览",
    preview_loading: "正在生成预览",
    preview_ready: "预览已就绪",
    batch_running: "正在批量导出",
    batch_complete: "批处理已完成",
  }[workflowStage];

  useEffect(() => {
    invoke<BootstrapState>("bootstrap_state")
      .then(setBootstrapState)
      .catch(() => setBootstrapState(null));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          setIsDragActive(true);
          return;
        }

        if (event.payload.type === "drop") {
          setIsDragActive(false);
          setImporting(true);
          try {
            await importPaths(event.payload.paths);
            setNotification({
              kind: "success",
              message: `已通过拖拽导入 ${event.payload.paths.length} 个路径来源。`,
            });
          } catch (error) {
            setNotification({ kind: "error", message: `拖拽导入失败：${String(error)}` });
          } finally {
            setImporting(false);
          }
          return;
        }

        setIsDragActive(false);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        setNotification({
          kind: "info",
          message: "当前环境未启用窗口拖拽监听，请先使用按钮导入。",
        });
      });

    return () => {
      unlisten?.();
    };
  }, []);

  async function importPaths(paths: string[]) {
    const summary = await invoke<ImportSummary>("import_paths", { paths });
    applyImportSummary(summary);
  }

  async function importWithDialog(mode: "files" | "folder") {
    setImporting(true);

    try {
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
      await importPaths(paths);
    } catch (error) {
      setNotification({ kind: "error", message: `导入失败：${String(error)}` });
    } finally {
      setImporting(false);
    }
  }

  async function chooseOutputDir() {
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

  async function refreshPreview() {
    if (!selectedImage) {
      return;
    }

    setPreviewLoading(true);

    try {
      const result = await invoke<PreviewResult>("preview_cleanup", {
        request: {
          path: selectedImage.path,
          region,
          baseWidth: selectedImage.width,
          baseHeight: selectedImage.height,
          sizeHandlingMode,
          cleanupMethod,
          blurSigma,
          fillColor,
        } satisfies PreviewRequest,
      });
      setPreview(result);
      setNotification({ kind: "success", message: "样张预览已更新，可以继续检查效果或直接批量导出。" });
    } catch (error) {
      setNotification({ kind: "error", message: `预览生成失败：${String(error)}` });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runBatch() {
    await runBatchForPaths(importedImages.map((item) => item.path));
  }

  async function runBatchForPaths(paths: string[]) {
    if (paths.length === 0) {
      setNotification({ kind: "info", message: "没有可重试的失败项。" });
      return;
    }

    if (importedImages.length === 0) {
      return;
    }

    setBatchRunning(true);

    try {
      const result = await invoke<BatchResult>("run_batch_cleanup", {
        request: {
          paths,
          region,
          baseWidth: selectedImage?.width ?? 1,
          baseHeight: selectedImage?.height ?? 1,
          sizeHandlingMode,
          cleanupMethod,
          blurSigma,
          fillColor,
          outputDir: outputDir || null,
        } satisfies BatchRequest,
      });

      setLastBatchResult(result);
      addHistory({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        importedCount: importedImages.length,
        successCount: result.successCount,
        failedCount: result.failedCount,
        outputDir: result.outputDir,
        cleanupMethod,
      });
      setNotification({
        kind: "success",
        message: `批处理完成：共 ${result.processedCount} 张，${result.successCount} 成功，${result.failedCount} 失败。`,
      });
    } catch (error) {
      setNotification({ kind: "error", message: `批处理失败：${String(error)}` });
    } finally {
      setBatchRunning(false);
    }
  }

  function saveCurrentTemplate() {
    const name = window.prompt("模板名称");
    if (!name) {
      return;
    }
    saveTemplate(name.trim());
  }

  async function retryFailedOnly() {
    const failedPaths =
      lastBatchResult?.entries.filter((entry) => !entry.success).map((entry) => entry.sourcePath) ?? [];
    await runBatchForPaths(failedPaths);
  }

  function applyCleanupPreset(presetId: string) {
    const preset = cleanupPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    updateRegion(preset.region);
    setCleanupMethod(preset.cleanupMethod);
    setBlurSigma(preset.blurSigma);
    setFillColor(preset.fillColor);
    setNotification({
      kind: "info",
      message: `已应用预设：${preset.label}。${preset.detail}`,
    });
  }

  return (
    <div
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,95,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink ${
        isDragActive ? "ring-4 ring-primary/20" : ""
      }`}
    >
      {isDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-[28px] border border-primary/30 bg-white px-8 py-6 text-center shadow-ambient">
            <p className="text-sm uppercase tracking-[0.28em] text-primary-strong">拖拽导入</p>
            <p className="mt-2 text-2xl font-semibold">释放鼠标即可导入图片或文件夹</p>
            <p className="mt-2 text-sm text-muted">当前会自动读取拖入路径下的 `png / jpg / jpeg / webp` 图片。</p>
          </div>
        </div>
      ) : null}
      <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)_360px] gap-4 p-4">
        <aside className="rounded-panel border border-white/70 bg-surface-rail/75 p-5 shadow-ambient backdrop-blur">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-primary text-lg font-semibold text-white">
                豆
              </div>
              <div>
                <p className="text-base font-semibold">豆包 AI 去水印助手</p>
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Doubao AI MVP</p>
              </div>
            </div>
            {bootstrapState ? (
              <p className="mt-3 text-xs text-muted">
                {bootstrapState.platform} · {bootstrapState.appVersion}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <button
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-60"
              type="button"
              disabled={isImporting}
              onClick={() => importWithDialog("files")}
            >
              {isImporting ? "导入中..." : "导入图片"}
            </button>
            <button
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium"
              type="button"
              disabled={isImporting}
              onClick={() => importWithDialog("folder")}
            >
              导入文件夹
            </button>
            <button
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium"
              type="button"
              onClick={chooseOutputDir}
            >
              {outputDir ? "修改导出目录" : "选择导出目录"}
            </button>
            <button
              className="w-full rounded-2xl border border-[#efc1c1] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#9a2020] disabled:opacity-60"
              type="button"
              disabled={importedImages.length === 0}
              onClick={clearWorkspace}
            >
              清空当前任务
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">当前导出目录</p>
            <p className="mt-2 break-all text-sm">{outputDir || "未指定，将自动生成到源目录下"}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">已导入图片</p>
              <p className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                {importedImages.length}
              </p>
            </div>
            <div className="mt-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
              {importedImages.length === 0 ? (
                <p className="text-sm text-muted">先导入图片或文件夹，再开始调整区域和预览。</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted">可单独移除当前图片，或直接清空整个任务。</p>
                    {selectedImageId ? (
                      <button
                        className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium"
                        type="button"
                        onClick={() => removeImage(selectedImageId)}
                      >
                        移除当前图片
                      </button>
                    ) : null}
                  </div>
                  <ImageList
                    items={importedImages}
                    selectedImageId={selectedImageId}
                    onSelect={selectImage}
                  />
                </>
              )}
            </div>
          </div>
        </aside>

        <main className="rounded-panel border border-white/70 bg-surface-panel/85 p-6 shadow-ambient backdrop-blur">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary-strong">Workflow</p>
              <h1 className="mt-2 text-3xl font-semibold">导入、预览、批处理</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                当前版本只针对豆包 AI 图片去标识场景。默认假设水印具有稳定规则，优先从右下角位置入手；当前提供的是轻量修复，不是 PS 级内容识别修复。
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                来源模板: 豆包 AI
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                状态: {workflowLabel}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                处理方式: {cleanupMethod}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                批量套用: {sizeHandlingMode}
              </span>
            </div>
          </header>

          {warnings.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-[#f0d8a8] bg-[#fff6df] p-4">
              <p className="text-sm font-medium text-warning">导入提醒</p>
              <ul className="mt-2 space-y-1 text-sm text-[#8a5b00]">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {notification ? (
            <section
              className={`mt-6 rounded-2xl border p-4 text-sm ${
                notification.kind === "error"
                  ? "border-[#f1c6c6] bg-[#fff1f1] text-[#9a2020]"
                  : notification.kind === "success"
                    ? "border-[#cde8d6] bg-[#f0faf4] text-[#17603a]"
                    : "border-line bg-[#f6f8fb] text-muted"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p>{notification.message}</p>
                <button
                  className="text-xs underline underline-offset-2"
                  type="button"
                  onClick={() => setNotification(null)}
                >
                  关闭
                </button>
              </div>
            </section>
          ) : null}

          {importedImages.length === 0 ? (
            <section className="mt-6 rounded-[28px] border border-dashed border-primary/35 bg-[linear-gradient(180deg,_rgba(0,95,184,0.06),_rgba(255,255,255,0.96))] p-8">
              <p className="text-sm uppercase tracking-[0.28em] text-primary-strong">Step 1</p>
              <h2 className="mt-2 text-3xl font-semibold">先导入豆包 AI 图片，再开始处理</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                当前第一版只针对豆包 AI 出图。导入后会默认按豆包右下角规则开始，你只需要核对样张并做小幅修正。
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                现在支持按钮导入和桌面拖拽导入；如果拖拽无效，再回退到按钮导入。
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-60"
                  type="button"
                  disabled={isImporting}
                  onClick={() => importWithDialog("files")}
                >
                  {isImporting ? "导入中..." : "选择图片文件"}
                </button>
                <button
                  className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium"
                  type="button"
                  disabled={isImporting}
                  onClick={() => importWithDialog("folder")}
                >
                  选择图片文件夹
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  "1. 导入一批豆包 AI 图片",
                  "2. 核对右下角默认规则，必要时微调",
                  "3. 生成样张后直接批量导出",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-line bg-white/90 p-4 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-4">
                <article className="rounded-2xl border border-line bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">当前样张</p>
                  <p className="mt-2 truncate text-sm font-medium">
                    {selectedImage?.name ?? "未选择"}
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">区域像素</p>
                  <p className="mt-2 text-sm font-medium">
                    {regionPixels
                      ? `${regionPixels.x}, ${regionPixels.y}, ${regionPixels.width}, ${regionPixels.height}`
                      : "未生成"}
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">预览状态</p>
                  <p className="mt-2 text-sm font-medium">
                    {isPreviewLoading
                      ? "生成中"
                      : preview
                        ? "已生成"
                        : "待生成"}
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">最近输出</p>
                  <p className="mt-2 truncate text-sm font-medium">
                    {lastBatchResult?.outputDir ?? "尚未导出"}
                  </p>
                </article>
              </section>

              <section className="mt-6 grid gap-4 xl:grid-cols-2">
                <PreviewCard
                  title="原图 / 区域"
                  image={preview?.sourceDataUrl ?? selectedImage?.thumbnailDataUrl ?? null}
                  region={region}
                  selected={Boolean(selectedImage)}
                  editable
                  onRegionChange={updateRegion}
                  dimensions={
                    selectedImage
                      ? { width: selectedImage.width, height: selectedImage.height }
                      : undefined
                  }
                />
                <ComparePreview
                  sourceImage={preview?.sourceDataUrl ?? null}
                  processedImage={preview?.processedDataUrl ?? null}
                  slider={compareSlider}
                  onSliderChange={setCompareSlider}
                />
              </section>

              <section className="mt-6 rounded-[24px] border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage || isPreviewLoading}
                    onClick={refreshPreview}
                  >
                    {isPreviewLoading ? "生成中..." : "刷新样张预览"}
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={importedImages.length === 0 || isBatchRunning}
                    onClick={runBatch}
                  >
                    {isBatchRunning ? "批处理中..." : "开始批量导出"}
                  </button>
                </div>

                {lastBatchResult ? (
                  <div className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm">
                    <p className="font-medium">
                      最近一次结果: 共 {lastBatchResult.processedCount} 张，{lastBatchResult.successCount} 成功 / {lastBatchResult.failedCount} 失败
                    </p>
                    <p className="mt-2 break-all text-muted">{lastBatchResult.outputDir}</p>
                    {lastBatchResult.failedCount > 0 ? (
                      <div className="mt-3 space-y-2">
                        <button
                          className="rounded-xl border border-[#efc1c1] bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#9a2020]"
                          type="button"
                          disabled={isBatchRunning}
                          onClick={retryFailedOnly}
                        >
                          仅重试失败项
                        </button>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-line bg-surface p-3">
                          {lastBatchResult.entries
                            .filter((entry) => !entry.success)
                            .map((entry) => (
                              <div key={`${entry.sourcePath}-${entry.outputPath}`} className="text-xs">
                                <p className="truncate font-medium text-[#9a2020]">{entry.sourcePath}</p>
                                <p className="mt-1 text-muted">{entry.error ?? "未知错误"}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </main>

        <aside className="rounded-panel border border-white/70 bg-[#f1f4f8]/88 p-5 shadow-ambient backdrop-blur">
          <section className="rounded-[24px] border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
              参数控制
            </h3>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">场景预设</p>
                <div className="grid gap-2">
                  {cleanupPresets.map((preset) => (
                    <button
                      key={preset.id}
                      className="rounded-2xl border border-line bg-white px-4 py-3 text-left hover:border-primary-strong"
                      type="button"
                      onClick={() => applyCleanupPreset(preset.id)}
                    >
                      <p className="text-sm font-medium">{preset.label}</p>
                      <p className="mt-1 text-xs text-muted">{preset.detail}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">来源规则</p>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <p className="text-sm font-medium">豆包 AI / 右下角规则</p>
                  <p className="mt-1 text-xs text-muted">
                    导入图片后会按豆包水印的右下角规律自动定位，当前只保留轻量微调，不开放通用自动识别模式。
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">批量尺寸策略</p>
                <div className="grid gap-2">
                  {[
                    {
                      id: "relative",
                      label: "按比例套用",
                      detail: "适合同构图，区域按百分比映射到每张图。",
                    },
                    {
                      id: "absolute",
                      label: "按样张像素",
                      detail: "适合不同尺寸但水印像素大小基本不变的素材。",
                    },
                    {
                      id: "bottomRight",
                      label: "右下角对齐",
                      detail: "适合固定贴在右下角的水印，保留样张边距。",
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        sizeHandlingMode === mode.id
                          ? "border-primary bg-primary/8"
                          : "border-line bg-white hover:border-primary-strong"
                      }`}
                      type="button"
                      onClick={() => setSizeHandlingMode(mode.id as SizeHandlingMode)}
                    >
                      <p className="text-sm font-medium">{mode.label}</p>
                      <p className="mt-1 text-xs text-muted">{mode.detail}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">清理方式</p>
                <div className="grid grid-cols-3 gap-2">
                  {["blur", "fill", "crop"].map((method) => (
                    <button
                      key={method}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase ${
                        cleanupMethod === method
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white"
                      }`}
                      type="button"
                      onClick={() => setCleanupMethod(method as CleanupMethod)}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>修复混合强度</span>
                  <span className="font-mono text-xs text-muted">{blurSigma.toFixed(1)}</span>
                </div>
                <input
                  className="w-full accent-primary"
                  type="range"
                  min={1}
                  max={40}
                  step={1}
                  value={blurSigma}
                  onChange={(event) => setBlurSigma(Number(event.target.value))}
                />
                <p className="mt-2 text-xs text-muted">
                  数值越高，当前轻量修复会更偏向周边纹理混合，不代表真正的 AI 内容识别。
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">填充颜色</span>
                <div className="flex items-center gap-3">
                  <input
                    className="h-11 w-16 rounded-xl border border-line bg-white"
                    type="color"
                    value={fillColor}
                    onChange={(event) => setFillColor(event.target.value)}
                  />
                  <input
                    className="h-11 flex-1 rounded-xl border border-line bg-white px-3"
                    value={fillColor}
                    onChange={(event) => setFillColor(event.target.value)}
                  />
                </div>
              </label>

              <RegionSliders region={region} onChange={updateRegion} />
              <RegionInputs region={region} onChange={updateRegion} />

              {selectedImage ? (
                <div className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">
                  当前样张: {selectedImage.name}
                  <br />
                  像素区域: x {Math.round(region.x * selectedImage.width)}, y{" "}
                  {Math.round(region.y * selectedImage.height)}, w{" "}
                  {Math.round(region.width * selectedImage.width)}, h{" "}
                  {Math.round(region.height * selectedImage.height)}
                </div>
              ) : null}
            </div>
          </section>

          <div className="mt-4">
            <TemplatesPanel
              templates={templates}
              onApply={applyTemplate}
              onSave={saveCurrentTemplate}
            />
          </div>

          <div className="mt-4">
            <HistoryPanel history={history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
