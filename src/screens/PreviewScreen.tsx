import type { ImportedImage, PreviewTaskEvent } from "../types";
import { ImageSampleList } from "../components/builder/ImageSampleList";
import { ComparisonSlider } from "../components/preview/ComparisonSlider";
import { getCleanupMethodLabel } from "../lib/formatting";

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
  afterSrc,
  currentTemplateName,
  cleanupMethod,
  sizeHandlingMode,
  previewStatus,
  loadingMessage,
  onSelectImage,
  onOpenTemplates,
}: {
  importedImages: ImportedImage[];
  selectedImageId: string | null;
  selectedImage: ImportedImage | null;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
  beforeSrc: string | null;
  afterSrc: string | null;
  currentTemplateName: string;
  cleanupMethod: "blur" | "fill" | "crop";
  sizeHandlingMode: "relative" | "absolute" | "bottomRight";
  previewStatus: string;
  loadingMessage?: string;
  onSelectImage: (id: string) => void;
  onOpenTemplates?: () => void;
}) {
  if (importedImages.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        暂无可预览图片，请先导入图片并完成模板构建。
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-[720px] grid-cols-[280px_minmax(0,1fr)_320px] gap-5">
      <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Preview Samples</p>
            <p className="mt-2 text-sm font-medium text-ink">{importedImages.length} 张待确认样图</p>
          </div>
          <p className="text-xs text-muted">{selectedImage ? selectedImage.name : "未选择"}</p>
        </div>
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          <ImageSampleList
            items={importedImages}
            selectedImageId={selectedImageId}
            onSelect={onSelectImage}
            previewTaskStateByImageId={previewTaskStateByImageId}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-[28px] border border-line bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-ink">当前页面只做效果确认，不再暴露复杂编辑能力。</p>
          <p className="mt-2 text-xs text-muted">
            {loadingMessage || "拖动中间滑杆查看处理前后差异，确认无误后再开始批量处理。"}
          </p>
        </div>
        <ComparisonSlider beforeSrc={beforeSrc} afterSrc={afterSrc} />
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Template Summary</p>
          {onOpenTemplates && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-white transition-colors"
              type="button"
              onClick={onOpenTemplates}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              切换模板
            </button>
          )}
        </div>
        <div className="mt-5 space-y-4">
          <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
            <p className="text-xs text-muted">模板名称</p>
            <p className="mt-2 text-sm font-medium text-ink">{currentTemplateName || "未命名模板"}</p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
            <p className="text-xs text-muted">处理方式</p>
            <p className="mt-2 text-sm font-medium text-ink">{getCleanupMethodLabel(cleanupMethod)}</p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
            <p className="text-xs text-muted">定位方式</p>
            <p className="mt-2 text-sm font-medium text-ink">{sizeHandlingMode}</p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
            <p className="text-xs text-muted">预览状态</p>
            <p className="mt-2 text-sm font-medium text-ink">{previewStatus}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
