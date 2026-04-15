import type { CleanupMethod, ImportedImage, PreviewTaskEvent, Region, SizeHandlingMode } from "../types";
import { useEffect } from "react";
import { ImageSampleList } from "../components/builder/ImageSampleList";
import { PreviewCanvasCard } from "../components/builder/PreviewCanvasCard";
import { RegionInputs } from "../components/builder/RegionInputs";
import { RegionSliders } from "../components/builder/RegionSliders";

type PreviewTaskState = {
  taskId: string;
  stage: PreviewTaskEvent["stage"];
  message: string;
};

export function TemplateBuilderScreen({
  importedImages,
  selectedImage,
  selectedImageId,
  previewTaskStateByImageId,
  region,
  cleanupMethod,
  sizeHandlingMode,
  blurSigma,
  fillColor,
  outputDir,
  currentTemplateName,
  isTemplateDirty,
  hasRegionSelection,
  previewReady,
  isPreviewBusy,
  canSaveTemplate,
  canOpenPreview,
  nextActionLabel,
  nextActionHint,
  onSelectImage,
  onUpdateRegion,
  onSetCleanupMethod,
  onSetSizeHandlingMode,
  onSetBlurSigma,
  onSetFillColor,
  onSetOutputDir,
  onChooseOutputDir,
  onSetCurrentTemplateName,
  onResetRegion,
  onClearRegionSelection,
  onResetCurrentRegionSettings,
  onImportFiles,
  onImportFolder,
  onClearWorkspace,
  onRemoveSelectedImage,
  onRemoveImage,
  onOpenTemplates,
  onSaveTemplate,
  onOpenPreview,
}: {
  importedImages: ImportedImage[];
  selectedImage: ImportedImage | null;
  selectedImageId: string | null;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  outputDir: string;
  currentTemplateName: string;
  isTemplateDirty: boolean;
  hasRegionSelection: boolean;
  previewReady: boolean;
  isPreviewBusy: boolean;
  canSaveTemplate: boolean;
  canOpenPreview: boolean;
  nextActionLabel: string;
  nextActionHint: string;
  onSelectImage: (id: string) => void;
  onUpdateRegion: (patch: Partial<Region>) => void;
  onSetCleanupMethod: (method: CleanupMethod) => void;
  onSetSizeHandlingMode: (mode: SizeHandlingMode) => void;
  onSetBlurSigma: (value: number) => void;
  onSetFillColor: (value: string) => void;
  onSetOutputDir: (value: string) => void;
  onChooseOutputDir: () => void;
  onSetCurrentTemplateName: (value: string) => void;
  onResetRegion: () => void;
  onClearRegionSelection: () => void;
  onResetCurrentRegionSettings: () => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onClearWorkspace: () => void;
  onRemoveSelectedImage: () => void;
  onRemoveImage: (id: string) => void;
  onOpenTemplates: () => void;
  onSaveTemplate: () => void;
  onOpenPreview: () => void;
}) {
  // ── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip when user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // [Patch #1] Skip arrow keys when focus is inside the region overlay
      // (PreviewCanvasCard uses arrow keys for region adjustment)
      if ((event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") && target.closest("[data-region-overlay]")) {
        return;
      }

      if (importedImages.length === 0) {
        return;
      }

      // Arrow keys: navigate between images
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        // [Patch #2] Use the same sort order as ImageSampleList for visual consistency
        const sorted = importedImages.length > 1
          ? [...importedImages].sort((a, b) => a.name.localeCompare(b.name))
          : importedImages;
        const currentIndex = sorted.findIndex((img) => img.id === selectedImageId);
        if (currentIndex === -1) {
          onSelectImage(sorted[0].id);
          return;
        }
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(currentIndex + 1, sorted.length - 1)
            : Math.max(currentIndex - 1, 0);
        if (nextIndex !== currentIndex) {
          onSelectImage(sorted[nextIndex].id);
        }
        return;
      }

      // Delete/Backspace: remove selected image
      if ((event.key === "Delete" || event.key === "Backspace") && selectedImageId) {
        event.preventDefault();
        onRemoveImage(selectedImageId);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [importedImages, selectedImageId, onSelectImage, onRemoveImage]);

  return (
    <div className="grid h-full min-h-0 gap-4">
      <div className="grid min-h-0 grid-cols-[212px_minmax(0,1fr)_264px] gap-4">
        <section className="min-h-0 rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">样图列表</p>
              <p className="mt-1 text-xs text-muted">{importedImages.length} 张，可切换参考图</p>
            </div>
            {importedImages.length > 0 ? (
              <button
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-white hover:text-ink"
                type="button"
                onClick={onClearWorkspace}
              >
                清空任务
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
              type="button"
              onClick={onImportFiles}
            >
              导入图片
            </button>
            <button
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
              type="button"
              onClick={onImportFolder}
            >
              导入文件夹
            </button>
          </div>

          {importedImages.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-line bg-surface px-5 py-10 text-sm text-muted">
              先导入一组图片，再在中间选一张作为参考图。
            </div>
          ) : (
              <div className="mt-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                <ImageSampleList
                  items={importedImages}
                  selectedImageId={selectedImageId}
                onSelect={onSelectImage}
                onRemove={onRemoveImage}
                previewTaskStateByImageId={previewTaskStateByImageId}
              />
            </div>
          )}
        </section>

        <section className="min-w-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <div className="rounded-[28px] border border-line bg-white px-5 py-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">模板名称</span>
                  <input
                    className="h-9 w-full max-w-sm rounded-xl border border-line bg-surface px-3 text-sm"
                    placeholder="例如：右下角小字清理"
                    value={currentTemplateName}
                    onChange={(event) => onSetCurrentTemplateName(event.target.value)}
                  />
                </label>
                <p className="mt-2.5 text-sm font-medium text-ink">{selectedImage?.name ?? "未选择样图"}</p>
                <p className="mt-1 text-xs text-muted">
                  把这张图当作参考图，在下方直接框出你想处理的区域。
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedImage ? (
                  <button
                    className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-white hover:text-ink"
                    type="button"
                    onClick={onRemoveSelectedImage}
                  >
                    移除当前图片
                  </button>
                ) : null}
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium hover:bg-white hover:text-ink"
                  type="button"
                  onClick={onOpenTemplates}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  切换模板
                </button>
                {isTemplateDirty ? (
                  <span className="rounded-full bg-[#fff6df] px-3 py-1 text-xs font-medium text-warning">
                    未保存
                  </span>
                ) : (
                  <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-xs font-medium text-success">
                    已同步
                  </span>
                )}
              </div>
            </div>
          </div>

          <PreviewCanvasCard
            title="参考图编辑区"
            image={selectedImage?.thumbnailDataUrl ?? null}
            region={hasRegionSelection ? region : undefined}
            selected={Boolean(selectedImage)}
            frameHeight={396}
            editable
            onRegionChange={onUpdateRegion}
            dimensions={selectedImage ? { width: selectedImage.width, height: selectedImage.height } : undefined}
            loading={isPreviewBusy}
            loadingMessage="正在生成样张预览..."
          />

          <div className="rounded-[24px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.98))] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Step 3</p>
                <p className="mt-2 text-sm font-medium text-ink">框选完成后，先生成一张预览看看效果</p>
                <p className="mt-1 text-xs text-muted">{nextActionHint}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!canSaveTemplate}
                  onClick={onSaveTemplate}
                  title={canSaveTemplate ? "保存当前模板配置" : "请先填写模板名称并保留选区"}
                >
                  保存模板
                </button>
                <button
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!canOpenPreview}
                  onClick={onOpenPreview}
                  title={nextActionHint}
                >
                  <span>{nextActionLabel}</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full bg-white px-3 py-2">样图 {selectedImage ? "已选择" : "未选择"}</span>
              <span className="rounded-full bg-white px-3 py-2">选区 {hasRegionSelection ? "已完成" : "未完成"}</span>
              <span className="rounded-full bg-white px-3 py-2">
                当前状态 {isPreviewBusy ? "处理中" : previewReady ? "可继续" : "待确认"}
              </span>
            </div>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-ink">快速设置</p>
          <p className="mt-1 text-xs text-muted">先用下面的简单选项，足够大多数图片处理。</p>

          <div className="mt-4 space-y-4">
            <div>
              <span className="mb-2 block text-sm font-medium text-ink">适配与处理</span>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">怎么适配不同尺寸</p>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => {
                        // 简单的提示切换逻辑
                        const el = document.getElementById('size-hint');
                        el?.classList.toggle('hidden');
                      }}
                    >
                      什么是这个？
                    </button>
                  </div>
                  <div id="size-hint" className="hidden rounded-[16px] bg-surface px-3 py-2 text-[10px] text-muted leading-relaxed">
                    <p>• <span className="font-medium text-ink">贴右下角：</span>水印总是在图片右下角</p>
                    <p>• <span className="font-medium text-ink">跟随比例：</span>按图片尺寸比例缩放位置</p>
                    <p>• <span className="font-medium text-ink">固定位置：</span>位置固定不变，图片尺寸不同可能偏移</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "bottomRight", label: "贴右下角" },
                      { id: "relative", label: "跟随比例" },
                      { id: "absolute", label: "固定位置" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          sizeHandlingMode === mode.id ? "border-primary bg-primary text-white" : "border-line bg-surface"
                        }`}
                        type="button"
                        onClick={() => onSetSizeHandlingMode(mode.id as SizeHandlingMode)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">怎么处理这块内容</p>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => {
                        const el = document.getElementById('method-hint');
                        el?.classList.toggle('hidden');
                      }}
                    >
                      什么是这个？
                    </button>
                  </div>
                  <div id="method-hint" className="hidden rounded-[16px] bg-surface px-3 py-2 text-[10px] text-muted leading-relaxed">
                    <p>• <span className="font-medium text-ink">智能修复：</span>AI 自动填充，效果最自然</p>
                    <p>• <span className="font-medium text-ink">直接盖住：</span>用纯色覆盖，简单快速</p>
                    <p>• <span className="font-medium text-ink">裁掉这一块：</span>直接裁剪掉选区内容</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "blur", label: "智能修复" },
                      { id: "fill", label: "直接盖住" },
                      { id: "crop", label: "裁掉这一块" },
                    ].map((method) => (
                      <button
                        key={method.id}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          cleanupMethod === method.id ? "border-primary bg-primary text-white" : "border-line bg-surface"
                        }`}
                        type="button"
                        onClick={() => onSetCleanupMethod(method.id as CleanupMethod)}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>

                  {cleanupMethod === "blur" ? (
                    <div className="mt-2 rounded-[18px] border border-line bg-surface px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">修复强度</span>
                        <input
                          className="flex-1 accent-primary"
                          type="range"
                          min={1}
                          max={40}
                          step={1}
                          value={blurSigma}
                          onChange={(event) => onSetBlurSigma(Number(event.target.value))}
                        />
                        <span className="w-8 text-right font-mono text-xs text-muted">{blurSigma.toFixed(0)}</span>
                      </div>
                    </div>
                  ) : null}

                  {cleanupMethod === "fill" ? (
                    <div className="mt-2 rounded-[18px] border border-line bg-surface px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          className="h-7 w-10 rounded border border-line bg-white p-0.5"
                          type="color"
                          value={fillColor}
                          onChange={(event) => onSetFillColor(event.target.value)}
                        />
                        <input
                          className="flex-1 h-7 rounded-lg border border-line bg-white px-2 text-xs"
                          value={fillColor}
                          onChange={(event) => onSetFillColor(event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <details className="rounded-[24px] border border-line bg-surface px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">精确调整位置（高级）</summary>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">处理位置</span>
                  <div className="flex gap-1.5">
                    <button
                      className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium"
                      type="button"
                      onClick={onClearRegionSelection}
                    >
                      清除
                    </button>
                    <button
                      className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium"
                      type="button"
                      onClick={onResetRegion}
                    >
                      重置
                    </button>
                  </div>
                </div>

                {hasRegionSelection ? (
                  <>
                    <RegionInputs region={region} onChange={onUpdateRegion} />
                    <RegionSliders region={region} onChange={onUpdateRegion} />
                  </>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-line bg-white px-4 py-6 text-sm text-muted">
                    当前没有选区，请点击中间图片重新创建处理区域。
                  </div>
                )}

                <button
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium"
                  type="button"
                  onClick={onResetCurrentRegionSettings}
                >
                  重置参数
                </button>
              </div>
            </details>

            <details className="rounded-[24px] border border-line bg-surface px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">更多设置</summary>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-muted">输出目录</span>
                  <div className="flex gap-2">
                    <input
                      className="h-11 flex-1 rounded-xl border border-line bg-white px-3"
                      value={outputDir}
                      onChange={(event) => onSetOutputDir(event.target.value)}
                    />
                    <button
                      className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
                      type="button"
                      onClick={onChooseOutputDir}
                    >
                      选择
                    </button>
                  </div>
                </label>
              </div>
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
}
