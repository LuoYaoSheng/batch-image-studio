import type { BatchResult, BatchProgressEvent, ImportedImage } from "../types";
import { formatDuration } from "../lib/formatting";

export function BatchScreen({
  importedImages,
  progress,
  startedAt,
  result,
  onRetryFailedOnly,
  onBackHome,
  onOpenOutputDir,
}: {
  importedImages: ImportedImage[];
  progress: BatchProgressEvent | null;
  startedAt: number | null;
  result: BatchResult | null;
  onRetryFailedOnly: () => void;
  onBackHome: () => void;
  onOpenOutputDir: () => void;
}) {
  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const failedEntries = result?.entries.filter((entry) => !entry.success) ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Batch Progress</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">
              {progress ? "批量任务进行中" : result ? "批量任务已完成" : "等待开始批量任务"}
            </h3>
            <p className="mt-3 text-sm text-muted">
              {progress
                ? `当前 ${progress.completed}/${progress.total} 张，成功 ${progress.successCount}，失败 ${progress.failedCount}`
                : result
                  ? `共处理 ${result.processedCount} 张，成功 ${result.successCount}，失败 ${result.failedCount}`
                  : "从预览页开始批量处理后，这里会显示进度和结果。"}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary-strong">
            {progress ? `${percent}%` : result ? "100%" : "0%"}
          </div>
        </div>

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
          </div>

          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-ink">批量操作</p>
            <div className="mt-5 space-y-3">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
