import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWorkspaceStore } from "./store/workspace";
import type {
  BatchResult,
  BatchProgressEvent,
  BatchTaskEvent,
  BatchTaskStarted,
  CleanupMethod,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
  MaskPreviewResult,
  PreviewCache,
  PreviewCacheEntry,
  PreviewTaskEvent,
  PreviewTaskStarted,
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

type BatchPreviewProgress = {
  total: number;
  completed: number;
  currentImageName: string;
};

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
    label: "豆包文字角标",
    detail: "适合豆包 AI 常见的右下角文字或小图标角标。",
    cleanupMethod: "blur",
    blurSigma: 10,
    region: { x: 0.72, y: 0.8, width: 0.22, height: 0.12 },
    fillColor: "#f7f9fc",
  },
  {
    id: "doubao-card",
    label: "豆包卡片角标",
    detail: "适合右下角带半透明底板、缩略图或更大占位的角标。",
    cleanupMethod: "blur",
    blurSigma: 14,
    region: { x: 0.66, y: 0.74, width: 0.28, height: 0.18 },
    fillColor: "#f7f9fc",
  },
  {
    id: "doubao-light-fill",
    label: "浅底快速盖除",
    detail: "适合纯色或浅色背景，直接填充比修复更稳定。",
    cleanupMethod: "fill",
    blurSigma: 8,
    region: { x: 0.68, y: 0.76, width: 0.24, height: 0.14 },
    fillColor: "#ffffff",
  },
];

function getCleanupMethodLabel(method: CleanupMethod) {
  switch (method) {
    case "fill":
      return "填充";
    case "crop":
      return "裁切";
    default:
      return "修复";
  }
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number) {
  if (ms <= 0) {
    return "少于 1 秒";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${seconds} 秒`;
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
  loading = false,
  loadingMessage,
}: {
  title: string;
  image: string | null;
  region?: Region;
  selected?: boolean;
  dimensions?: { width: number; height: number };
  editable?: boolean;
  onRegionChange?: (patch: Partial<Region>) => void;
  loading?: boolean;
  loadingMessage?: string;
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
          <img
            alt={title}
            className={`h-[320px] w-full object-contain transition duration-300 ${
              loading ? "scale-[0.985] opacity-45" : "opacity-100"
            }`}
            src={image}
          />
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
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/72 backdrop-blur-[2px]">
            <div className="rounded-2xl border border-primary/15 bg-white/95 px-5 py-4 text-center shadow-sm">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="mt-3 text-sm font-medium text-primary-strong">
                {loadingMessage ?? "正在刷新预览..."}
              </p>
            </div>
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

function ImageList({
  items,
  selectedImageId,
  onSelect,
  previewTaskStateByImageId,
}: {
  items: ImportedImage[];
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
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
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium">{item.name}</p>
              {previewTaskStateByImageId[item.id] ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {previewTaskStateByImageId[item.id]?.stage === "completed"
                    ? "已缓存"
                    : previewTaskStateByImageId[item.id]?.stage === "error"
                      ? "失败"
                      : "处理中"}
                </span>
              ) : null}
            </div>
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
              <span className="font-mono text-xs text-muted">
                {getCleanupMethodLabel(template.cleanupMethod)}
              </span>
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
                <p className="text-sm font-medium">{getCleanupMethodLabel(item.cleanupMethod)}</p>
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

function BatchProgressPanel({
  progress,
  startedAt,
  failedEntries,
  showFailedEntries,
  onToggleFailedEntries,
}: {
  progress: BatchProgressEvent | null;
  startedAt: number | null;
  failedEntries: BatchResult["entries"];
  showFailedEntries: boolean;
  onToggleFailedEntries: () => void;
}) {
  if (!progress) {
    return null;
  }

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  const remainingMs =
    startedAt && progress.completed > 0 && progress.completed < progress.total
      ? (elapsedMs / progress.completed) * (progress.total - progress.completed)
      : 0;
  const failedOnly = failedEntries.filter((entry) => !entry.success);

  return (
    <section className="mt-6 rounded-[24px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.06),_rgba(255,255,255,0.96))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary-strong">
            {progress.stage === "completed" ? "批处理已完成" : "批处理任务进行中"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {progress.completed}/{progress.total} 张，成功 {progress.successCount}，失败 {progress.failedCount}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-primary-strong">
          {percent}%
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        {progress.stage === "completed" ? (
          startedAt ? (
            <span className="rounded-full bg-white px-3 py-1">
              总耗时 {formatDuration(elapsedMs)}
            </span>
          ) : null
        ) : progress.completed > 0 ? (
          <span className="rounded-full bg-white px-3 py-1">
            预计剩余 {formatDuration(remainingMs)}
          </span>
        ) : (
          <span className="rounded-full bg-white px-3 py-1">正在估算剩余时间</span>
        )}
      </div>
      <p className="mt-3 truncate text-sm text-muted">当前文件: {progress.currentFile}</p>
      {failedOnly.length > 0 ? (
        <div className="mt-4">
          <button
            className="rounded-xl border border-[#efc1c1] bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#9a2020]"
            type="button"
            onClick={onToggleFailedEntries}
          >
            {showFailedEntries ? "收起失败项" : `查看失败项 (${failedOnly.length})`}
          </button>
          {showFailedEntries ? (
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-line bg-white p-3">
              {failedOnly.map((entry) => (
                <div key={`${entry.sourcePath}-${entry.outputPath}`} className="text-xs">
                  <p className="truncate font-medium text-[#9a2020]">{entry.sourcePath}</p>
                  <p className="mt-1 text-muted">{entry.error ?? "未知错误"}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"processed" | "source" | "mask">("processed");
  const [dragOverlayState, setDragOverlayState] = useState<DragOverlayState>("idle");
  const [batchProgress, setBatchProgress] = useState<BatchProgressEvent | null>(null);
  const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
  const [showFailedEntries, setShowFailedEntries] = useState(false);
  const [batchPreviewProgress, setBatchPreviewProgress] = useState<BatchPreviewProgress | null>(null);
  const [maskPreviewDataUrl, setMaskPreviewDataUrl] = useState<string | null>(null);
  const [maskPreviewImageId, setMaskPreviewImageId] = useState<string | null>(null);
  const [maskPreviewMessage, setMaskPreviewMessage] = useState("");
  const [previewCache, setPreviewCache] = useState<PreviewCache | null>(null);
  const [previewCacheMap, setPreviewCacheMap] = useState<Record<string, PreviewCacheEntry>>({});
  const [processedCacheMap, setProcessedCacheMap] = useState<Record<string, PreviewCache>>({});
  const [previewTaskStateByImageId, setPreviewTaskStateByImageId] = useState<
    Record<string, PreviewTaskState | undefined>
  >({});
  const previewTaskContextByTaskIdRef = useRef<
    Record<string, { imageId: string; sourcePath: string; signature: string }>
  >({});
  const lastImportSignatureRef = useRef("");
  const lastImportAtRef = useRef(0);
  const dragSessionLockedRef = useRef(false);
  const modelWarmupAttemptedRef = useRef(false);
  const activeBatchTaskIdRef = useRef<string | null>(null);
  const activeBatchSignatureByPathRef = useRef<Record<string, string>>({});
  const previewTaskPromiseRef = useRef<
    Record<string, { resolve: () => void; reject: (error: Error) => void }>
  >({});
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
    isModelLoading,
    isModelLoaded,
    modelLoadProgress,
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
    setModelLoading,
    setModelLoaded,
    setModelLoadProgress,
  } = useWorkspaceStore();

  const selectedImage = importedImages.find((item) => item.id === selectedImageId) ?? null;
  const selectedImageIdRef = useRef<string | null>(selectedImageId);
  const regionPixels = selectedImage
    ? {
        x: Math.round(region.x * selectedImage.width),
        y: Math.round(region.y * selectedImage.height),
        width: Math.round(region.width * selectedImage.width),
        height: Math.round(region.height * selectedImage.height),
      }
    : null;
  const selectedPreviewTaskState = selectedImage
    ? (previewTaskStateByImageId[selectedImage.id] ?? null)
    : null;
  const isAnyPreviewTaskRunning = Object.values(previewTaskStateByImageId).some((task) =>
    isPreviewTaskActive(task?.stage),
  );
  const isSelectedPreviewTaskRunning = isPreviewTaskActive(selectedPreviewTaskState?.stage);
  const isSelectedMaskPreviewLoading = maskPreviewImageId === selectedImage?.id;
  const isSelectedImageBusy = isSelectedPreviewTaskRunning || isSelectedMaskPreviewLoading;
  const workflowStage = isBatchRunning
    ? "batch_running"
    : isSelectedImageBusy
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
  const previewLoadingMessage = isSelectedMaskPreviewLoading
    ? (maskPreviewMessage || "正在生成 Mask...")
    : (selectedPreviewTaskState?.message || "");
  const processedPreviewSrc = preview?.processedImagePath
    ? convertFileSrc(preview.processedImagePath)
    : null;
  const processedPreviewDisplaySrc = preview?.processedDisplayDataUrl ?? processedPreviewSrc;
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
  const isBatchPreviewRunning = batchPreviewProgress !== null;

  useEffect(() => {
    const shouldSetPreviewLoading = isAnyPreviewTaskRunning || maskPreviewImageId !== null;
    if (isPreviewLoading !== shouldSetPreviewLoading) {
      setPreviewLoading(shouldSetPreviewLoading);
    }
  }, [isAnyPreviewTaskRunning, isPreviewLoading, maskPreviewImageId, setPreviewLoading]);

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);

  useEffect(() => {
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
        setBootstrapState(null);
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    let unlistenBatch: (() => void) | undefined;
    let unlistenBatchTask: (() => void) | undefined;
    let unlistenPreview: (() => void) | undefined;

    listen<BatchProgressEvent>("batch-progress", (event) => {
      if (!mounted) {
        return;
      }
      logUi("batch-progress:event", event.payload);
      setBatchProgress(event.payload);
    })
      .then((fn) => {
        unlistenBatch = fn;
        logUi("batch-progress:listener-ready");
      })
      .catch((error) => {
        logUi("batch-progress:listener-error", { error: String(error) });
        console.error("批处理进度监听失败:", error);
      });

    listen<BatchTaskEvent>("batch-task", (event) => {
      if (!mounted) {
        return;
      }

      const payload = event.payload;
      logUi("batch-task:event", payload as unknown as Record<string, unknown>);
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
            setPreviewTaskStateByImageId((current) => {
              const next = { ...current };
              for (const entry of batchResult.entries) {
                if (!entry.success) {
                  continue;
                }
                const image = importedImages.find((item) => item.path === entry.sourcePath);
                if (!image) {
                  continue;
                }
                next[image.id] = {
                  taskId: activeBatchTaskIdRef.current ?? payload.taskId,
                  stage: "completed",
                  message: "批处理已生成缓存",
                };
              }
              return next;
            });
            logUi("batch-cache:merged", {
              taskId: payload.taskId,
              cachedCount: batchResult.entries.filter((entry) => entry.success).length,
            });
            addHistory({
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              importedCount: importedImages.length,
              successCount: batchResult.successCount,
              failedCount: batchResult.failedCount,
              outputDir: batchResult.outputDir,
              cleanupMethod,
            });
            setNotification({
              kind: "success",
              message: `批处理完成：共 ${batchResult.processedCount} 张，${batchResult.successCount} 成功，${batchResult.failedCount} 失败。`,
            });
          }
          setBatchRunning(false);
          activeBatchTaskIdRef.current = null;
          logUi("batch:done-event", { taskId: payload.taskId });
          break;
        case "error":
          setBatchRunning(false);
          setBatchStartedAt(null);
          activeBatchTaskIdRef.current = null;
          logUi("batch:error-event", {
            taskId: payload.taskId,
            error: payload.error ?? payload.message,
          });
          setNotification({ kind: "error", message: `批处理失败：${payload.error ?? payload.message}` });
          break;
        default:
          break;
      }
    })
      .then((fn) => {
        unlistenBatchTask = fn;
        logUi("batch-task:listener-ready");
      })
      .catch((error) => {
        logUi("batch-task:listener-error", { error: String(error) });
      });

    listen<PreviewTaskEvent>("preview-task", (event) => {
      if (!mounted) {
        return;
      }

      const payload = event.payload;
      logUi("preview-task:event", payload as unknown as Record<string, unknown>);
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
            const { imageId, sourcePath, signature } = context;
            const previewResult = payload.result;
            if (isCurrentImage) {
              setPreview(previewResult);
            }
            const cacheEntry = {
              preview: previewResult,
              maskDataUrl: null,
              sourcePath,
              signature,
            } satisfies PreviewCacheEntry;
            setPreviewCache({
              sourcePath,
              cachedProcessedPath: previewResult.cachedProcessedPath,
              signature,
            });
            setPreviewCacheMap((current) => ({
              ...current,
              [signature]: cacheEntry,
            }));
            setProcessedCacheMap((current) => ({
              ...current,
              [signature]: {
                sourcePath,
                cachedProcessedPath: previewResult.cachedProcessedPath,
                signature,
              },
            }));
            setPreviewTaskStateByImageId((current) => ({
              ...current,
              [imageId]: {
                taskId: payload.taskId,
                stage: "completed",
                message: payload.message,
              },
            }));
          }
          previewTaskPromiseRef.current[payload.taskId]?.resolve();
          delete previewTaskPromiseRef.current[payload.taskId];
          delete previewTaskContextByTaskIdRef.current[payload.taskId];
          if (isCurrentImage) {
            setNotification({ kind: "success", message: "样张预览已更新，可以继续检查效果或直接批量导出。" });
          }
          break;
        case "error":
          setPreviewTaskStateByImageId((current) => ({
            ...current,
            [context.imageId]: {
              taskId: payload.taskId,
              stage: "error",
              message: payload.error ?? payload.message,
            },
          }));
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
    })
      .then((fn) => {
        unlistenPreview = fn;
        logUi("preview-task:listener-ready");
      })
      .catch((error) => {
        logUi("preview-task:listener-error", { error: String(error) });
      });

    return () => {
      mounted = false;
      unlistenBatch?.();
      unlistenBatchTask?.();
      unlistenPreview?.();
    };
  }, [addHistory, cleanupMethod, importedImages.length, setBatchRunning, setLastBatchResult, setPreview]);

  useEffect(() => {
    setShowFailedEntries(false);
  }, [lastBatchResult]);

  useEffect(() => {
    if (!bootstrapState || modelWarmupAttemptedRef.current || isModelLoaded || isModelLoading) {
      return;
    }

    if (isImporting || isAnyPreviewTaskRunning || isBatchRunning || dragOverlayState !== "idle") {
      return;
    }

    let cancelled = false;
    modelWarmupAttemptedRef.current = true;

    const warmupInBackground = async () => {
      logUi("model-preload:background-scheduled");
      await waitForIdlePeriod(4000);
      if (cancelled) {
        return;
      }
      logUi("model-preload:background-start");
      await ensureModelReady("preview");
    };

    void warmupInBackground();

    return () => {
      cancelled = true;
    };
  }, [
    bootstrapState,
    dragOverlayState,
    isAnyPreviewTaskRunning,
    isBatchRunning,
    isImporting,
    isModelLoaded,
    isModelLoading,
  ]);

  useEffect(() => {
    setMaskPreviewDataUrl(null);
    setPreviewCache(null);
    if (resultViewMode === "mask") {
      setResultViewMode("processed");
    }
  }, [
    blurSigma,
    cleanupMethod,
    fillColor,
    region.height,
    region.width,
    region.x,
    region.y,
    resultViewMode,
    selectedImageId,
    sizeHandlingMode,
  ]);

  useEffect(() => {
    if (!currentPreviewSignature) {
      return;
    }

    const cached = previewCacheMap[currentPreviewSignature];
    if (cached) {
      logUi("preview-cache:restore", {
        sourcePath: cached.sourcePath,
        hasMask: Boolean(cached.maskDataUrl),
      });
      setPreview(cached.preview);
      setPreviewCache({
        sourcePath: cached.sourcePath,
        cachedProcessedPath: cached.preview.cachedProcessedPath,
        signature: cached.signature,
      });
      setMaskPreviewDataUrl(cached.maskDataUrl);
      return;
    }

    const processedCache = processedCacheMap[currentPreviewSignature];
    if (!processedCache || !selectedImage) {
      return;
    }

    logUi("processed-cache:restore", {
      sourcePath: processedCache.sourcePath,
      cachedProcessedPath: processedCache.cachedProcessedPath,
    });
    setPreview({
      processedImagePath: processedCache.cachedProcessedPath,
      processedDisplayDataUrl: "",
      outputWidth: selectedImage.width,
      outputHeight: selectedImage.height,
      cachedProcessedPath: processedCache.cachedProcessedPath,
    });
    setPreviewCache(processedCache);
    setMaskPreviewDataUrl(null);
  }, [currentPreviewSignature, previewCacheMap, processedCacheMap, selectedImage, setPreview]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        logUi("drag-drop:event", { type: event.payload.type });

        if (event.payload.type === "over") {
          if (dragSessionLockedRef.current || isImporting) {
            logUi("drag-drop:over-ignored", {
              isImporting,
              dragSessionLocked: dragSessionLockedRef.current,
            });
            return;
          }
          logUi("drag-drop:over");
          setDragOverlayState("hover");
          return;
        }

        if (event.payload.type === "drop") {
          logUi("drag-drop:drop", { pathCount: event.payload.paths.length });
          dragSessionLockedRef.current = true;
          setDragOverlayState("importing");
          setImporting(true);
          try {
            await waitForUiCommit();
            await importPaths(event.payload.paths);
            setNotification({
              kind: "success",
              message: `已通过拖拽导入 ${event.payload.paths.length} 个路径来源。`,
            });
          } catch (error) {
            setNotification({ kind: "error", message: `拖拽导入失败：${String(error)}` });
          } finally {
            setImporting(false);
            setDragOverlayState("idle");
            logUi("drag-drop:drop-finished");
          }
          return;
        }

        logUi("drag-drop:leave");
        dragSessionLockedRef.current = false;
        setDragOverlayState("idle");
      })
      .then((fn) => {
        unlisten = fn;
        logUi("drag-drop:listener-ready");
      })
      .catch(() => {
        logUi("drag-drop:listener-error");
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
    const startedAt = performance.now();
    logUi("import:start", { pathCount: paths.length });
    const signature = normalizePaths(paths);
    const now = Date.now();
    if (
      signature.length > 0 &&
      signature === lastImportSignatureRef.current &&
      now - lastImportAtRef.current < 1500
    ) {
      logUi("import:dedup-skipped", { pathCount: paths.length });
      return;
    }
    lastImportSignatureRef.current = signature;
    lastImportAtRef.current = now;
    setBatchProgress(null);
    setBatchStartedAt(null);
    setShowFailedEntries(false);
    setMaskPreviewDataUrl(null);
    setPreviewCache(null);
    setPreviewCacheMap({});
    setProcessedCacheMap({});
    setPreviewTaskStateByImageId({});
    previewTaskContextByTaskIdRef.current = {};
    const summary = await invoke<ImportSummary>("import_paths", { paths });
    logUi("import:done", {
      itemCount: summary.items.length,
      warningCount: summary.warnings.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    applyImportSummary(summary);
  }

  async function importWithDialog(mode: "files" | "folder") {
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
        logUi("import-dialog:cancelled", { mode });
        return;
      }

      const paths = Array.isArray(selected) ? selected : [selected];
      logUi("import-dialog:selected", { mode, pathCount: paths.length });
      await waitForUiCommit();
      await importPaths(paths);
    } catch (error) {
      logUi("import-dialog:error", { mode, error: String(error) });
      setNotification({ kind: "error", message: `导入失败：${String(error)}` });
    } finally {
      setImporting(false);
      logUi("import-dialog:finish", { mode });
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

  async function ensureModelReady(reason: "preview" | "batch") {
    if (isModelLoaded) {
      return true;
    }

    if (isModelLoading) {
      logUi("model-preload:already-loading", { reason });
      return false;
    }

    logUi("model-preload:lazy-start", { reason });
    setModelLoading(true);
    setModelLoadProgress(0);
    try {
      if (reason !== "preview") {
        await waitForUiCommit();
      }
      const result = await invoke<ModelLoadState>("preload_model");
      setModelLoadProgress(100);
      logUi("model-preload:lazy-done", { reason, ...result });
      if (result.isLoaded) {
        setModelLoaded(true);
      }
      return result.isLoaded;
    } catch (error) {
      logUi("model-preload:lazy-error", { reason, error: String(error) });
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
    const signature = getSignatureForImage(image);
    logUi("preview:start", {
      trigger,
      imageId: image.id,
      cleanupMethod,
      sizeHandlingMode,
    });
    setPreviewTaskStateByImageId((current) => ({
      ...current,
      [image.id]: {
        taskId: current[image.id]?.taskId ?? "",
        stage: "started",
        message: "正在读取原图...",
      },
    }));

    if (!isModelLoaded && !isModelLoading) {
      setPreviewTaskStateByImageId((current) => ({
        ...current,
        [image.id]: {
          taskId: current[image.id]?.taskId ?? "",
          stage: "started",
          message: "正在预热 AI 引擎...",
        },
      }));
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
    logUi("preview:task-started", { trigger, taskId: started.taskId, imageId: image.id });
    return taskPromise;
  }

  async function refreshPreview(trigger: "manual" | "auto" = "manual") {
    if (!selectedImage || isSelectedImageBusy) {
      return;
    }

    setMaskPreviewDataUrl(null);

    try {
      await startPreviewForImage(selectedImage, trigger);
    } catch (error) {
      logUi("preview:error", { trigger, error: String(error) });
      setPreviewTaskStateByImageId((current) => ({
        ...current,
        [selectedImage.id]: {
          taskId: current[selectedImage.id]?.taskId ?? "",
          stage: "error",
          message: `预览生成失败：${String(error)}`,
        },
      }));
      setNotification({ kind: "error", message: `预览生成失败：${String(error)}` });
    }
  }

  async function refreshMaskPreview() {
    if (!selectedImage || isSelectedImageBusy) {
      return;
    }

    const startedAt = performance.now();
    logUi("preview-mask:start", {
      imageId: selectedImage.id,
      cleanupMethod,
      sizeHandlingMode,
    });
    setMaskPreviewImageId(selectedImage.id);
    setMaskPreviewMessage("正在生成 Mask...");

    try {
      await waitForUiCommit();
      const result = await invoke<MaskPreviewResult>("preview_mask", {
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
      setMaskPreviewDataUrl(result.maskDataUrl);
      setResultViewMode("mask");
      if (preview && currentPreviewSignature) {
        setPreviewCacheMap((current) => {
          const existing = current[currentPreviewSignature];
          if (!existing) {
            return current;
          }
          return {
            ...current,
            [currentPreviewSignature]: {
              ...existing,
              maskDataUrl: result.maskDataUrl,
            },
          };
        });
      }
      logUi("preview-mask:done", {
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      logUi("preview-mask:error", { error: String(error) });
      setNotification({ kind: "error", message: `Mask 预览生成失败：${String(error)}` });
    } finally {
      setMaskPreviewImageId(null);
      setMaskPreviewMessage("");
    }
  }

  async function runBatch() {
    await runBatchForPaths(importedImages.map((item) => item.path));
  }

  async function exportCurrentImage() {
    if (!selectedImage) {
      return;
    }
    await runBatchForPaths([selectedImage.path]);
  }

  async function runBatchPreview() {
    const pendingImages = importedImages.filter((image) => {
      if (hasProcessedCacheForImage(image)) {
        return false;
      }
      return !isPreviewTaskActive(previewTaskStateByImageId[image.id]?.stage);
    });

    if (pendingImages.length === 0) {
      setNotification({ kind: "info", message: "当前图片都已有缓存，无需再批量生成预览。" });
      return;
    }

    logUi("batch-preview:start", { total: pendingImages.length });
    setBatchPreviewProgress({
      total: pendingImages.length,
      completed: 0,
      currentImageName: pendingImages[0]?.name ?? "",
    });

    let completed = 0;
    try {
      for (const image of pendingImages) {
        setBatchPreviewProgress({
          total: pendingImages.length,
          completed,
          currentImageName: image.name,
        });
        await startPreviewForImage(image, "batch");
        completed += 1;
        setBatchPreviewProgress({
          total: pendingImages.length,
          completed,
          currentImageName: image.name,
        });
      }
      logUi("batch-preview:done", { total: pendingImages.length });
      setNotification({
        kind: "success",
        message: `批量预览完成，已为 ${pendingImages.length} 张图片生成缓存。`,
      });
    } catch (error) {
      logUi("batch-preview:error", { error: String(error), completed });
      setNotification({
        kind: "error",
        message: `批量预览中断：${String(error)}`,
      });
    } finally {
      setBatchPreviewProgress(null);
    }
  }

  async function runBatchForPaths(paths: string[]) {
    if (paths.length === 0) {
      setNotification({ kind: "info", message: "没有可重试的失败项。" });
      return;
    }

    if (importedImages.length === 0) {
      return;
    }

    logUi("batch:start", {
      pathCount: paths.length,
      cleanupMethod,
      sizeHandlingMode,
      reusePreviewCount: Object.values(processedCacheMap).length,
    });
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
          outputDir: outputDir || null,
          previewCaches: Object.values(processedCacheMap).map((cache) => ({
            sourcePath: cache.sourcePath,
            cachedProcessedPath: cache.cachedProcessedPath,
            signature: cache.signature,
          })),
        } satisfies BatchRequest,
      });
      activeBatchTaskIdRef.current = started.taskId;
      logUi("batch:task-started", { taskId: started.taskId, pathCount: paths.length });
    } catch (error) {
      setBatchProgress(null);
      setBatchStartedAt(null);
      setBatchRunning(false);
      logUi("batch:error", { error: String(error) });
      setNotification({ kind: "error", message: `批处理失败：${String(error)}` });
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
        dragOverlayState === "hover" ? "ring-4 ring-primary/20" : ""
      }`}
    >
      {dragOverlayState === "hover" ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-6">
          <div className="rounded-full border border-primary/25 bg-white/96 px-5 py-3 shadow-ambient backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-sm font-medium text-primary-strong">
                松手即可导入图片或文件夹
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {dragOverlayState === "importing" || isImporting ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-white/12 pt-10">
          <div className="rounded-2xl border border-primary/20 bg-white/96 px-5 py-3 shadow-ambient backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <div>
                <p className="text-sm font-medium text-primary-strong">正在导入图片</p>
                <p className="text-xs text-muted">拖拽态已结束，正在读取文件与生成缩略图</p>
              </div>
            </div>
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
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  isModelLoaded
                    ? "bg-[#edf7f1] text-[#17603a]"
                    : isModelLoading
                      ? "bg-primary/10 text-primary"
                      : "bg-surface text-muted"
                }`}
              >
                {isModelLoaded
                  ? "AI 引擎已就绪"
                  : isModelLoading
                    ? `AI 引擎预热中 ${Math.min(99, Math.round(modelLoadProgress))}%`
                    : "AI 引擎待启动"}
              </span>
            </div>
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
              <div className="flex items-center gap-2">
                {isImporting ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    导入中
                  </span>
                ) : null}
                <p className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                  {importedImages.length}
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
              {importedImages.length === 0 ? (
                isImporting ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div
                        key={item}
                        className="flex animate-pulse gap-3 rounded-2xl border border-line bg-surface p-3"
                      >
                        <div className="h-16 w-16 rounded-xl bg-white" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 w-2/3 rounded-full bg-white" />
                          <div className="h-3 w-1/2 rounded-full bg-white" />
                          <div className="h-3 w-1/3 rounded-full bg-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">先导入图片或文件夹，再开始调整区域和预览。</p>
                )
              ) : (
                <>
                  {isImporting ? (
                    <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary-strong">
                      正在补充导入内容，图片列表会继续更新。
                    </div>
                  ) : null}
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
                    previewTaskStateByImageId={previewTaskStateByImageId}
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
                当前版本只针对豆包 AI 图片去标识场景。默认按右下角规则生成选区，并优先使用文字修复算法处理；复杂卡片角标仍需你手动核对范围。
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
                处理方式: {getCleanupMethodLabel(cleanupMethod)}
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

          <BatchProgressPanel
            progress={batchProgress}
            startedAt={batchStartedAt}
            failedEntries={lastBatchResult?.entries ?? []}
            showFailedEntries={showFailedEntries}
            onToggleFailedEntries={() => setShowFailedEntries((value) => !value)}
          />

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
                    {isSelectedImageBusy
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
                  image={selectedImage?.thumbnailDataUrl ?? null}
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
                <PreviewCard
                  title={
                    resultViewMode === "processed"
                      ? "处理后预览"
                      : resultViewMode === "mask"
                        ? "Mask 识别预览"
                        : "效果位原图参考"
                  }
                  image={
                    resultViewMode === "processed"
                      ? processedPreviewDisplaySrc
                      : resultViewMode === "mask"
                        ? (maskPreviewDataUrl ?? null)
                      : (selectedImage?.thumbnailDataUrl ?? null)
                  }
                  selected={false}
                  dimensions={
                    resultViewMode === "processed" && preview
                      ? { width: preview.outputWidth, height: preview.outputHeight }
                      : selectedImage
                        ? { width: selectedImage.width, height: selectedImage.height }
                        : undefined
                  }
                  loading={isSelectedImageBusy}
                  loadingMessage={previewLoadingMessage}
                />
              </section>

              <section className="mt-6 rounded-[24px] border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage || isSelectedImageBusy || isBatchPreviewRunning}
                    onClick={() => void refreshPreview("manual")}
                  >
                    {isSelectedPreviewTaskRunning ? "生成中..." : "刷新样张预览"}
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={importedImages.length === 0 || isBatchRunning || isBatchPreviewRunning}
                    onClick={() => void runBatchPreview()}
                  >
                    {isBatchPreviewRunning ? "批量预览中..." : "批量生成预览"}
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={importedImages.length === 0 || isBatchRunning || isBatchPreviewRunning}
                    onClick={runBatch}
                  >
                    {isBatchRunning ? "批处理中..." : "开始批量导出"}
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage || isBatchRunning || isBatchPreviewRunning}
                    onClick={() => void exportCurrentImage()}
                  >
                    {isBatchRunning ? "导出中..." : "导出当前图片"}
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage}
                    onClick={() => setResultViewMode("processed")}
                  >
                    查看效果
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage}
                    onClick={() => setResultViewMode("source")}
                  >
                    查看原图
                  </button>
                  <button
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                    type="button"
                    disabled={!selectedImage || isSelectedImageBusy}
                    onClick={() => {
                      if (maskPreviewDataUrl) {
                        setResultViewMode("mask");
                        return;
                      }
                      void refreshMaskPreview();
                    }}
                  >
                    {isSelectedMaskPreviewLoading ? "生成 Mask 中..." : "查看 Mask"}
                  </button>
                </div>

                <p className="mt-3 text-sm text-muted">
                  导入后不会自动跑预览。先调整区域和参数，再手动点击“刷新样张预览”，这样可以减少等待和误触发。
                </p>
                {isSelectedImageBusy && previewLoadingMessage ? (
                  <p className="mt-2 text-sm text-primary-strong">{previewLoadingMessage}</p>
                ) : null}
                {isBatchPreviewRunning && batchPreviewProgress ? (
                  <p className="mt-2 text-sm text-primary-strong">
                    批量预览进行中：{batchPreviewProgress.completed}/{batchPreviewProgress.total}，当前 {batchPreviewProgress.currentImageName}
                  </p>
                ) : null}

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
                        <p className="text-xs text-muted">
                          失败详情已收纳到上方批处理任务面板，可展开查看。
                        </p>
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
                <p className="mb-3 text-xs text-muted">
                  当前规则会应用到本次导入的全部图片。不同尺寸的图片按下面策略换算区域。
                </p>
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
                <p className="mb-2 text-sm font-medium">处理方式</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "blur", label: "修复" },
                    { id: "fill", label: "填充" },
                    { id: "crop", label: "裁切" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase ${
                        cleanupMethod === method.id
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white"
                      }`}
                      type="button"
                      onClick={() => setCleanupMethod(method.id as CleanupMethod)}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>修复强度</span>
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
                  仅对“修复”模式生效。数值越高，水印 mask 会更宽，Telea 修复半径也会更大，适合半透明卡片角标。
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
