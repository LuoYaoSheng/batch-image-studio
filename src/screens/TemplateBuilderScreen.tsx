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
  return (
    <div className="grid h-full min-h-[720px] grid-cols-[280px_minmax(0,1fr)_360px] gap-5">
      <section className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
        <div className="rounded-[20px] bg-surface px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Step Guide</p>
          <div className="mt-4 space-y-3">
            {[
              { title: "Step 1", detail: "选样图并框选区域", active: true },
              { title: "Step 2", detail: "决定怎么适配这批图片", active: true },
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
            <div className="rounded-[24px] border border-dashed border-line bg-surface px-6 py-10 text-sm text-muted">
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
                onRemove={onRemoveImage}
                previewTaskStateByImageId={previewTaskStateByImageId}
              />
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 space-y-5">
        {/* 顶部信息栏 - 合并模板名称和图片信息 */}
        <div className="rounded-[28px] border border-line bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* 模板名称输入 */}
              <label className="block">
                <span className="mb-1 block text-xs text-muted">模板名称</span>
                <input
                  className="h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm"
                  placeholder="例如：右下角小字清理"
                  value={currentTemplateName}
                  onChange={(event) => onSetCurrentTemplateName(event.target.value)}
                />
              </label>
              <p className="mt-2 text-sm font-medium text-ink">{selectedImage?.name ?? "未选择样图"}</p>
              <p className="mt-1 text-xs text-muted">
                在画布上拖动蓝色区域即可调整模板处理范围。
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
          title="样图区域编辑"
          image={selectedImage?.thumbnailDataUrl ?? null}
          region={hasRegionSelection ? region : undefined}
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
        <p className="text-sm font-medium text-ink">处理方式</p>
        <p className="mt-1 text-xs text-muted">不确定时先用默认值，再看预览效果。</p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">处理位置</span>
              <div className="flex gap-1.5">
                <button
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium"
                  type="button"
                  onClick={onClearRegionSelection}
                >
                  清除
                </button>
                <button
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium"
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
                <div className="mt-4">
                  <RegionSliders region={region} onChange={onUpdateRegion} />
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-line bg-surface px-6 py-10 text-sm text-muted">
                当前没有选区，请点击图片重新创建处理区域。
              </div>
            )}
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink">适配与处理</span>
            <div className="grid grid-cols-2 gap-2">
              {/* 定位方式 */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted">怎么适配不同尺寸</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: "bottomRight", label: "贴右下角" },
                    { id: "relative", label: "跟随比例" },
                    { id: "absolute", label: "固定位置" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                        sizeHandlingMode === mode.id
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-surface"
                      }`}
                      type="button"
                      onClick={() => onSetSizeHandlingMode(mode.id as SizeHandlingMode)}
                      title={mode.id}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 处理方式 */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted">怎么处理这块内容</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: "blur", label: "智能修复" },
                    { id: "fill", label: "直接盖住" },
                    { id: "crop", label: "裁掉这一块" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
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
                {/* 处理方式相关参数 */}
                {cleanupMethod === "blur" && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted">强度</span>
                    <input
                      className="flex-1 accent-primary"
                      type="range"
                      min={1}
                      max={40}
                      step={1}
                      value={blurSigma}
                      onChange={(event) => onSetBlurSigma(Number(event.target.value))}
                    />
                    <span className="text-xs font-mono text-muted w-8 text-right">{blurSigma.toFixed(0)}</span>
                  </div>
                )}
                {cleanupMethod === "fill" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="h-7 w-10 rounded border border-line bg-white p-0.5"
                      type="color"
                      value={fillColor}
                      onChange={(event) => onSetFillColor(event.target.value)}
                    />
                    <input
                      className="flex-1 h-7 rounded-lg border border-line bg-surface px-2 text-xs"
                      value={fillColor}
                      onChange={(event) => onSetFillColor(event.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium"
                type="button"
                onClick={onResetCurrentRegionSettings}
              >
                重置参数
              </button>
            </div>
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

          <div className="rounded-[24px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.96))] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Next Step</p>
                <p className="mt-2 text-sm font-medium text-ink">完成当前模板后，继续效果确认</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  previewReady ? "bg-[#edf7f1] text-success" : "bg-[#fff6df] text-warning"
                }`}
              >
                {previewReady ? "预览已就绪" : "待生成预览"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
              <div className="rounded-xl bg-white/90 px-3 py-2">
                样图 {selectedImage ? "已选择" : "未选择"}
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2">
                选区 {hasRegionSelection ? "已完成" : "未完成"}
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2">
                模板名 {currentTemplateName.trim() ? "已填写" : "建议填写"}
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2">
                当前状态 {isPreviewBusy ? "处理中" : previewReady ? "可继续" : "待确认"}
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-muted">{nextActionHint}</p>

            <div className="mt-4 flex gap-3">
              <button
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!canOpenPreview}
                onClick={onOpenPreview}
                title={nextActionHint}
              >
                {nextActionLabel}
              </button>
              <button
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!canSaveTemplate}
                onClick={onSaveTemplate}
                title={canSaveTemplate ? "保存当前模板配置" : "请先填写模板名称并保留选区"}
              >
                保存模板
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
