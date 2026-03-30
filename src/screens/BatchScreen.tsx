import type { BatchResult, BatchProgressEvent, ImportedImage } from "../types";
import { formatDuration } from "../lib/formatting";

export function BatchScreen({
  importedImages,
  progress,
  startedAt,
  result,
  isBatchRunning,
  onRetryFailedOnly,
  onBackHome,
  onOpenOutputDir,
  onCancelBatch,
  onSwitchTemplate,
}: {
  importedImages: ImportedImage[];
  progress: BatchProgressEvent | null;
  startedAt: number | null;
  result: BatchResult | null;
  isBatchRunning: boolean;
  onRetryFailedOnly: () => void;
  onBackHome: () => void;
  onOpenOutputDir: () => void;
  onCancelBatch: () => void;
  onSwitchTemplate?: () => void;
}) {
  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const failedEntries = result?.entries.filter((entry) => !entry.success) ?? [];
  const isComplete = result !== null && !isBatchRunning;
  const isAllSuccess = isComplete && result.failedCount === 0;

  return (
    <div className="grid min-h-[780px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
      <section
        className={`rounded-[28px] border p-6 shadow-sm transition-all ${
          isAllSuccess ? "border-[#cde8d6] bg-gradient-to-br from-[#f0faf4] to-white" : "border-line bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {isAllSuccess ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#cde8d6]">
                <svg className="h-6 w-6 text-[#2d7a4e]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Batch Progress</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">
                {isAllSuccess ? "批量处理完成！" : progress ? "批量任务进行中" : result ? "批量任务已完成" : "等待开始批量任务"}
              </h3>
              {isAllSuccess ? (
                <p className="mt-3 text-sm text-muted">全部处理完成，可以直接打开结果目录或返回首页。</p>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  {progress
                    ? `当前 ${progress.completed}/${progress.total} 张，成功 ${progress.successCount}，失败 ${progress.failedCount}`
                    : result
                      ? `共处理 ${result.processedCount} 张，成功 ${result.successCount}，失败 ${result.failedCount}`
                      : "从预览页开始批量处理后，这里会显示进度和结果。"}
                </p>
              )}
            </div>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              isAllSuccess ? "bg-[#cde8d6] text-[#2d7a4e]" : "bg-primary/10 text-primary-strong"
            }`}
          >
            {isAllSuccess ? "✓ 完成" : progress ? `${percent}%` : result ? "100%" : "0%"}
          </div>
        </div>

        {!isAllSuccess ? (
          <>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress ? percent : result ? 100 : 0}%` }}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                <p className="text-xs text-muted">待处理图片</p>
                <p className="mt-2 text-sm font-medium text-ink">{importedImages.length} 张</p>
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                <p className="text-xs text-muted">当前文件</p>
                <p className="mt-2 truncate text-sm font-medium text-ink">{progress?.currentFile ?? "未开始"}</p>
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                <p className="text-xs text-muted">运行时长</p>
                <p className="mt-2 text-sm font-medium text-ink">
                  {startedAt ? formatDuration(elapsed) : "未开始"}
                </p>
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                <p className="text-xs text-muted">输出目录</p>
                <p className="mt-2 truncate text-sm font-medium text-ink">{result?.outputDir ?? "未生成"}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[#cde8d6] bg-white px-4 py-4">
              <p className="text-xs text-muted">成功处理</p>
              <p className="mt-2 text-lg font-semibold text-[#2d7a4e]">{result.successCount} 张</p>
            </div>
            <div className="rounded-[24px] border border-[#cde8d6] bg-white px-4 py-4">
              <p className="text-xs text-muted">总用时</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatDuration(elapsed)}</p>
            </div>
            <div className="rounded-[24px] border border-[#cde8d6] bg-white px-4 py-4">
              <p className="text-xs text-muted">输出目录</p>
              <p className="mt-2 truncate text-sm font-medium text-ink">{result.outputDir}</p>
            </div>
          </div>
        )}
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">任务队列</p>
              <p className="mt-1 text-xs text-muted">按当前导入顺序展示，方便你快速判断哪些图片成功、哪些失败。</p>
            </div>
            <p className="text-xs text-muted">{importedImages.length} 张</p>
          </div>

          <div className="mt-5 max-h-[calc(100vh-390px)] space-y-3 overflow-y-auto pr-1">
            {importedImages.map((image) => {
              const failed = failedEntries.find((entry) => entry.sourcePath === image.path);
              const completed = result?.entries.find((entry) => entry.sourcePath === image.path && entry.success);
              const isCurrent = progress?.currentFile === image.path;
              return (
                <div
                  key={image.id}
                  className={`rounded-[24px] border px-4 py-4 ${
                    failed
                      ? "border-[#efc1c1] bg-[#fff5f5]"
                      : isCurrent
                        ? "border-primary bg-primary/6"
                        : completed
                          ? "border-[#cde8d6] bg-[#f0faf4]"
                          : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="truncate text-sm font-medium text-ink">{image.name}</p>
                    <p className="text-xs text-muted">
                      {failed ? "失败" : isCurrent ? "处理中" : completed ? "成功" : "待处理"}
                    </p>
                  </div>
                  {failed?.error ? <p className="mt-2 text-xs text-[#9a2020]">{failed.error}</p> : null}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-ink">结果摘要</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4 text-sm text-muted">
                成功 {result?.successCount ?? progress?.successCount ?? 0} 张
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4 text-sm text-muted">
                失败 {result?.failedCount ?? progress?.failedCount ?? 0} 张
              </div>
            </div>
            {failedEntries.length > 0 ? (
              <div className="mt-4 rounded-[20px] border border-[#f0d8a8] bg-[#fff6df] px-4 py-4 text-sm text-[#8a5b00]">
                当前有 {failedEntries.length} 张失败。建议先重试失败项；如果失败集中在同一位置或比例，优先切换模板后重跑。
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-[#cde8d6] bg-[#f0faf4] px-4 py-4 text-sm text-[#17603a]">
                当前结果稳定，可以直接打开输出目录或返回首页继续下一批。
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-ink">下一步建议</p>
            <div className="mt-5 space-y-3 text-sm text-muted">
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                1. 先看失败数量和失败原因
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                2. 少量失败时优先只重试失败项
              </div>
              <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
                3. 如果整批失败风格一致，再切换模板重新处理
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.98))] px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Primary Action</p>
            <p className="mt-2 text-sm font-medium text-ink">
              {isBatchRunning ? "当前任务正在运行，建议先等待或取消任务。" : "先处理结果，再决定是否继续下一批。"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {failedEntries.length > 0
                ? "有失败项时优先重试失败图片；全部成功时优先打开输出目录确认结果。"
                : "没有失败项时，通常下一步就是打开输出目录查看结果。"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-2xl border border-[#efc1c1] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#9a2020] disabled:opacity-60"
              type="button"
              disabled={!isBatchRunning}
              onClick={onCancelBatch}
            >
              取消任务
            </button>
            <button
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
              type="button"
              disabled={failedEntries.length === 0}
              onClick={onRetryFailedOnly}
            >
              仅重试失败项
            </button>
            <button
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
              type="button"
              disabled={!result?.outputDir}
              onClick={onOpenOutputDir}
            >
              打开输出目录
            </button>
            {onSwitchTemplate && !isBatchRunning ? (
              <button
                className="rounded-2xl border border-primary bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-primary/6"
                type="button"
                onClick={onSwitchTemplate}
              >
                切换模板
              </button>
            ) : null}
            <button
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white"
              type="button"
              onClick={onBackHome}
            >
              返回首页
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
