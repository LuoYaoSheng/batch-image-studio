import type { ImportedImage, PreviewTaskEvent } from "../types";
import { ImageSampleList } from "../components/builder/ImageSampleList";
import { ComparisonSlider } from "../components/preview/ComparisonSlider";
import { getCleanupMethodLabel, getSizeHandlingModeLabel } from "../lib/formatting";

type PreviewTaskState = {
  taskId: string;
  stage: PreviewTaskEvent["stage"];
  message: string;
};

export function PreviewScreen({
  importedImages,
  selectedImageId,
  selectedImage,
  previewTaskStateByImageId,
  beforeSrc,
  beforeFallback,
  afterSrc,
  currentTemplateName,
  cleanupMethod,
  sizeHandlingMode,
  previewStatus,
  loadingMessage,
  isPreviewLoading = false,
  canStartBatch,
  batchReadyHint,
  outputDir,
  onSelectImage,
  onOpenTemplates,
  onStartBatch,
  onBackToBuilder,
  onChangeOutputDir,
}: {
  importedImages: ImportedImage[];
  selectedImageId: string | null;
  selectedImage: ImportedImage | null;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
  beforeSrc: string | null;
  beforeFallback?: string | null;
  afterSrc: string | null;
  currentTemplateName: string;
  cleanupMethod: "blur" | "fill" | "crop";
  sizeHandlingMode: "relative" | "absolute" | "bottomRight";
  previewStatus: string;
  loadingMessage?: string;
  isPreviewLoading?: boolean;
  canStartBatch: boolean;
  batchReadyHint: string;
  outputDir?: string;
  onSelectImage: (id: string) => void;
  onOpenTemplates?: () => void;
  onStartBatch?: () => void;
  onBackToBuilder?: () => void;
  onChangeOutputDir?: () => void;
}) {
  if (importedImages.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        暂无可预览图片，请先导入图片并完成模板构建。
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-[780px] grid-rows-[minmax(0,1fr)_auto] gap-4">
      <div className="grid min-h-0 grid-cols-[228px_minmax(0,1fr)] gap-4">
        <section className="min-h-0 rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">样图列表</p>
              <p className="mt-1 text-xs text-muted">{importedImages.length} 张待确认样图</p>
            </div>
            <p className="text-xs text-muted">{selectedImage ? selectedImage.name : "未选择"}</p>
          </div>

          <div className="max-h-[calc(100vh-375px)] overflow-y-auto pr-1">
            <ImageSampleList
              items={importedImages}
              selectedImageId={selectedImageId}
              onSelect={onSelectImage}
              previewTaskStateByImageId={previewTaskStateByImageId}
            />
          </div>
        </section>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <div className="rounded-[28px] border border-line bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">拖动分界线对比原图和处理效果</p>
                <p className="mt-2 text-xs text-muted">
                  {loadingMessage || "左边原图，右边处理后，拖动中间的分界线查看差异。"}
                </p>
                {outputDir && (
                  <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-surface px-3 py-2">
                    <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="min-w-0 flex-1 truncate text-xs text-muted">
                      输出：<span className="font-medium text-ink">{outputDir}</span>
                    </p>
                    {onChangeOutputDir && (
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                        onClick={onChangeOutputDir}
                      >
                        修改
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full bg-surface px-3 py-2">{currentTemplateName || "未命名"}</span>
                <span className="rounded-full bg-surface px-3 py-2">{getCleanupMethodLabel(cleanupMethod)}</span>
                <span className="rounded-full bg-surface px-3 py-2">{getSizeHandlingModeLabel(sizeHandlingMode)}</span>
                <span className={`rounded-full px-3 py-2 ${isPreviewLoading ? "bg-primary/10 text-primary font-medium animate-pulse" : "bg-surface"}`}>
                  {previewStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="min-h-0">
            <ComparisonSlider
              beforeSrc={beforeSrc}
              beforeFallback={beforeFallback}
              afterSrc={afterSrc}
              isLoading={isPreviewLoading}
              loadingMessage={loadingMessage}
            />
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.98))] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Next Step</p>
            <p className="mt-2 text-sm font-medium text-ink">确认效果无误后开始批量处理</p>
            <p className="mt-1 text-xs text-muted">将处理 {importedImages.length} 张图片</p>
            <p className={`mt-2 text-xs ${canStartBatch ? "text-success" : "text-warning"}`}>{batchReadyHint}</p>
          </div>

          <div className="flex items-center gap-3">
            {onBackToBuilder ? (
              <button
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-white transition-colors"
                type="button"
                onClick={onBackToBuilder}
              >
                返回修改
              </button>
            ) : null}
            {onOpenTemplates ? (
              <button
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-white transition-colors"
                type="button"
                onClick={onOpenTemplates}
              >
                切换模板
              </button>
            ) : null}
            {onStartBatch ? (
              <button
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled={!canStartBatch}
                onClick={onStartBatch}
                title={batchReadyHint}
              >
                开始批量处理
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
