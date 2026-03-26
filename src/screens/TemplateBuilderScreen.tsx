import type { CleanupMethod, ImportedImage, PreviewTaskEvent, Region, SizeHandlingMode } from "../types";
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
  previewReady,
  isPreviewBusy,
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
  onImportFiles,
  onImportFolder,
  onClearWorkspace,
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
  previewReady: boolean;
  isPreviewBusy: boolean;
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
  onImportFiles: () => void;
  onImportFolder: () => void;
  onClearWorkspace: () => void;
}) {
  return (
    <div className="grid h-full min-h-[720px] grid-cols-[280px_minmax(0,1fr)_360px] gap-5">
      <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
        <div className="rounded-[20px] bg-surface px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Step Guide</p>
          <div className="mt-4 space-y-3">
            {[
              { title: "Step 1", detail: "选样图并框选区域", active: true },
              { title: "Step 2", detail: "选择定位方式和处理方式", active: true },
              { title: "Step 3", detail: "预览后再开始批量处理", active: previewReady },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-2xl px-4 py-3 ${
                  item.active ? "bg-white text-ink shadow-sm" : "bg-white/50 text-muted"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">{item.title}</p>
                <p className="mt-1 text-sm">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">样图列表</p>
              <p className="text-xs text-muted">{importedImages.length} 张</p>
            </div>
            {importedImages.length > 0 ? (
              <button
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-white hover:text-ink"
                type="button"
                onClick={onClearWorkspace}
              >
                清空当前任务
              </button>
            ) : null}
          </div>
          {importedImages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-sm text-muted">
              <p>当前正在编辑模板配置。导入一组样图后，可以继续在画布上调整区域并生成预览。</p>
              <div className="mt-4 flex flex-wrap gap-3">
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
            </div>
          ) : (
            <div className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
              <ImageSampleList
                items={importedImages}
                selectedImageId={selectedImageId}
                onSelect={onSelectImage}
                previewTaskStateByImageId={previewTaskStateByImageId}
              />
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 space-y-5">
        <div className="rounded-[28px] border border-line bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">{selectedImage?.name ?? "未选择样图"}</p>
              <p className="mt-1 text-xs text-muted">
                在画布上拖动蓝色区域即可调整模板处理范围。
              </p>
            </div>
            {isTemplateDirty ? (
              <span className="rounded-full bg-[#fff6df] px-3 py-1 text-xs font-medium text-warning">
                有未保存更改
              </span>
            ) : (
              <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-xs font-medium text-success">
                模板已同步
              </span>
            )}
          </div>
        </div>

        <PreviewCanvasCard
          title="样图区域编辑"
          image={selectedImage?.thumbnailDataUrl ?? null}
          region={region}
          selected={Boolean(selectedImage)}
          editable
          onRegionChange={onUpdateRegion}
          dimensions={
            selectedImage ? { width: selectedImage.width, height: selectedImage.height } : undefined
          }
          loading={isPreviewBusy}
          loadingMessage="正在生成样张预览..."
        />
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">模板名称</span>
            <input
              className="h-11 w-full rounded-xl border border-line bg-surface px-3"
              placeholder="例如：右下角小字清理"
              value={currentTemplateName}
              onChange={(event) => onSetCurrentTemplateName(event.target.value)}
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">区域设置</span>
              <button
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium"
                type="button"
                onClick={onResetRegion}
              >
                重置区域
              </button>
            </div>
            <RegionInputs region={region} onChange={onUpdateRegion} />
            <div className="mt-4">
              <RegionSliders region={region} onChange={onUpdateRegion} />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink">定位方式</span>
            <div className="grid gap-2">
              {[
                { id: "bottomRight", label: "右下角锚定", detail: "适合边角固定位置的局部区域" },
                { id: "relative", label: "按比例定位", detail: "适合不同尺寸但构图接近的图片" },
                { id: "absolute", label: "固定像素", detail: "适合尺寸完全一致的图片" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    sizeHandlingMode === mode.id
                      ? "border-primary bg-primary/8"
                      : "border-line bg-surface"
                  }`}
                  type="button"
                  onClick={() => onSetSizeHandlingMode(mode.id as SizeHandlingMode)}
                >
                  <p className="text-sm font-medium text-ink">{mode.label}</p>
                  <p className="mt-1 text-xs text-muted">{mode.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink">处理方式</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "blur", label: "AI修复" },
                { id: "fill", label: "填充" },
                { id: "crop", label: "裁切" },
              ].map((method) => (
                <button
                  key={method.id}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase ${
                    cleanupMethod === method.id
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-surface"
                  }`}
                  type="button"
                  onClick={() => onSetCleanupMethod(method.id as CleanupMethod)}
                >
                  {method.label}
                </button>
              ))}
            </div>
            {cleanupMethod === "blur" ? (
              <label className="mt-3 block">
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
                  onChange={(event) => onSetBlurSigma(Number(event.target.value))}
                />
              </label>
            ) : null}
            {cleanupMethod === "fill" ? (
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-ink">填充颜色</span>
                <div className="flex items-center gap-3">
                  <input
                    className="h-11 w-16 rounded-xl border border-line bg-white"
                    type="color"
                    value={fillColor}
                    onChange={(event) => onSetFillColor(event.target.value)}
                  />
                  <input
                    className="h-11 flex-1 rounded-xl border border-line bg-surface px-3"
                    value={fillColor}
                    onChange={(event) => onSetFillColor(event.target.value)}
                  />
                </div>
              </label>
            ) : null}
          </div>

          <details className="rounded-[24px] border border-line bg-surface px-4 py-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">高级输出设置</summary>
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
      </section>
    </div>
  );
}
