import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "./store/workspace";
import type {
  BatchResult,
  CleanupMethod,
  HistoryEntry,
  ImportSummary,
  ImportedImage,
  PreviewResult,
  Region,
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
  cleanupMethod: CleanupMethod;
  blurSigma: number;
  fillColor: string;
};

type BatchRequest = {
  paths: string[];
  region: Region;
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
              {Math.round(region[control.key] * 100)}%
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

function PreviewCard({
  title,
  image,
  region,
  selected,
  dimensions,
}: {
  title: string;
  image: string | null;
  region?: Region;
  selected?: boolean;
  dimensions?: { width: number; height: number };
}) {
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

      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-line bg-white">
        {image ? (
          <img alt={title} className="h-[320px] w-full object-contain" src={image} />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted">
            暂无图像
          </div>
        )}
        {image && region && selected ? (
          <div
            className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,72,141,0.14)]"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          />
        ) : null}
      </div>
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
  const {
    importedImages,
    selectedImageId,
    warnings,
    preview,
    detectionMode,
    cleanupMethod,
    blurSigma,
    fillColor,
    region,
    outputDir,
    templates,
    history,
    isImporting,
    isPreviewLoading,
    isBatchRunning,
    lastBatchResult,
    setDetectionMode,
    setCleanupMethod,
    setBlurSigma,
    setFillColor,
    setOutputDir,
    updateRegion,
    setImporting,
    setPreviewLoading,
    setBatchRunning,
    applyImportSummary,
    selectImage,
    setPreview,
    setLastBatchResult,
    saveTemplate,
    applyTemplate,
    addHistory,
  } = useWorkspaceStore();

  const selectedImage = importedImages.find((item) => item.id === selectedImageId) ?? null;

  useEffect(() => {
    invoke<BootstrapState>("bootstrap_state")
      .then(setBootstrapState)
      .catch(() => setBootstrapState(null));
  }, []);

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
      const summary = await invoke<ImportSummary>("import_paths", { paths });
      applyImportSummary(summary);
    } catch (error) {
      window.alert(`导入失败：${String(error)}`);
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
          cleanupMethod,
          blurSigma,
          fillColor,
        } satisfies PreviewRequest,
      });
      setPreview(result);
    } catch (error) {
      window.alert(`预览生成失败：${String(error)}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runBatch() {
    if (importedImages.length === 0) {
      return;
    }

    setBatchRunning(true);

    try {
      const result = await invoke<BatchResult>("run_batch_cleanup", {
        request: {
          paths: importedImages.map((item) => item.path),
          region,
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
    } catch (error) {
      window.alert(`批处理失败：${String(error)}`);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,95,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
      <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)_360px] gap-4 p-4">
        <aside className="rounded-panel border border-white/70 bg-surface-rail/75 p-5 shadow-ambient backdrop-blur">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-primary text-lg font-semibold text-white">
                BI
              </div>
              <div>
                <p className="text-base font-semibold">Batch Image Studio</p>
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Testable MVP</p>
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
                <ImageList
                  items={importedImages}
                  selectedImageId={selectedImageId}
                  onSelect={selectImage}
                />
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
                第一版先用固定区域工作流跑通本地图片清理。自动识别与智能修复后续再接，这一版重点是把实际闭环跑通。
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                检测模式: {detectionMode}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                处理方式: {cleanupMethod}
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

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <PreviewCard
              title="原图 / 区域"
              image={preview?.sourceDataUrl ?? selectedImage?.thumbnailDataUrl ?? null}
              region={region}
              selected={Boolean(selectedImage)}
              dimensions={
                selectedImage ? { width: selectedImage.width, height: selectedImage.height } : undefined
              }
            />
            <PreviewCard
              title="处理后预览"
              image={preview?.processedDataUrl ?? null}
              dimensions={
                preview
                  ? { width: preview.outputWidth, height: preview.outputHeight }
                  : undefined
              }
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
                  最近一次结果: {lastBatchResult.successCount} 成功 / {lastBatchResult.failedCount} 失败
                </p>
                <p className="mt-2 break-all text-muted">{lastBatchResult.outputDir}</p>
              </div>
            ) : null}
          </section>
        </main>

        <aside className="rounded-panel border border-white/70 bg-[#f1f4f8]/88 p-5 shadow-ambient backdrop-blur">
          <section className="rounded-[24px] border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
              参数控制
            </h3>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">检测模式</p>
                <div className="grid grid-cols-3 gap-2">
                  {["fixed", "auto", "hybrid"].map((mode) => (
                    <button
                      key={mode}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase ${
                        detectionMode === mode
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white"
                      }`}
                      type="button"
                      onClick={() => setDetectionMode(mode as "fixed" | "auto" | "hybrid")}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">当前可测试的是 fixed 工作流。</p>
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
                  <span>模糊强度</span>
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
