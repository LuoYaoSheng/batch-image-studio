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
    <div className="space-y-6">
      <section className={`rounded-[28px] border p-6 shadow-sm transition-all ${
        isAllSuccess ? "border-[#cde8d6] bg-gradient-to-br from-[#f0faf4] to-white" : "border-line bg-white"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* 完成状态图标 */}
            {isAllSuccess && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#cde8d6]">
                <svg className="h-6 w-6 text-[#2d7a4e]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Batch Progress</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">
                {isAllSuccess ? "批量处理完成！" : progress ? "批量任务进行中" : result ? "批量任务已完成" : "等待开始批量任务"}
              </h3>
              {isAllSuccess ? null : (
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
          <div className={`rounded-full px-4 py-2 text-sm font-medium ${
            isAllSuccess
              ? "bg-[#cde8d6] text-[#2d7a4e]"
              : "bg-primary/10 text-primary-strong"
          }`}>
            {isAllSuccess ? "✓ 完成" : progress ? `${percent}%` : result ? "100%" : "0%"}
          </div>
        </div>

        {!isAllSuccess && (
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
        )}

        {isAllSuccess && (
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">任务队列</p>
            <p className="text-xs text-muted">按当前导入顺序展示</p>
          </div>
          <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
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

        <div className="space-y-5">
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
          ) : null}
        </div>

          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-ink">批量操作</p>
            <div className="mt-5 space-y-3">
              <button
                className="w-full rounded-2xl border border-[#efc1c1] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#9a2020] disabled:opacity-60"
                type="button"
                disabled={!isBatchRunning}
                onClick={onCancelBatch}
              >
                取消任务
              </button>
              <button
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium disabled:opacity-60"
                type="button"
                disabled={!result?.outputDir}
                onClick={onOpenOutputDir}
              >
                打开输出目录
              </button>
              <button
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium disabled:opacity-60"
                type="button"
                disabled={failedEntries.length === 0}
                onClick={onRetryFailedOnly}
              >
                仅重试失败项
              </button>
              <button
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white"
                type="button"
                onClick={onBackHome}
              >
                返回首页
              </button>
              {onSwitchTemplate && !isBatchRunning && (
                <button
                  className="w-full rounded-2xl border border-primary bg-primary/6 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                  type="button"
                  onClick={onSwitchTemplate}
                >
                  切换模板重新处理
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
