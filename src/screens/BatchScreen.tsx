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

  // 计算预计剩余时间和处理速度
  const calculateEstimates = () => {
    if (!progress || progress.completed === 0 || !startedAt) {
      return { remaining: null, speed: null };
    }
    const remaining = progress.total - progress.completed;
    const avgTimePerItem = elapsed / progress.completed;
    const remainingTime = Math.round(avgTimePerItem * remaining);
    // 计算每分钟处理速度
    const elapsedMinutes = elapsed / 60000;
    const speed = elapsedMinutes > 0 ? Math.round(progress.completed / elapsedMinutes) : null;
    return { remaining: remainingTime, speed };
  };

  const { remaining: remainingTime, speed: processSpeed } = calculateEstimates();

  // 预构建 sourcePath → entry 查找表，避免 N×M 的 find 操作
  const successPathSet = isAllSuccess
    ? null // 全部成功时不需要逐条匹配
    : new Set(result?.entries.filter((e) => e.success).map((e) => e.sourcePath));
  const failedPathMap = new Map(failedEntries.map((e) => [e.sourcePath, e]));

  /** 获取单张图片的处理状态 */
  function getImageStatus(image: ImportedImage): "success" | "failed" | "processing" | "pending" {
    if (isAllSuccess) return "success";
    const failed = failedPathMap.get(image.path);
    if (failed) return "failed";
    if (progress?.currentFile === image.path && isBatchRunning) return "processing";
    if (successPathSet?.has(image.path)) return "success";
    return "pending";
  }

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
                <p className="mt-3 text-sm text-muted">全部处理完成，可以直接打开结果目录或开始新任务。</p>
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

            {/* 额外信息：剩余时间和处理速度 */}
            {(remainingTime !== null || processSpeed !== null) && (
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                {remainingTime !== null && remainingTime > 0 && (
                  <div className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>预计剩余：{formatDuration(remainingTime)}</span>
                  </div>
                )}
                {processSpeed !== null && processSpeed > 0 && (
                  <div className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>处理速度：约 {processSpeed} 张/分钟</span>
                  </div>
                )}
              </div>
            )}
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
              const status = getImageStatus(image);
              return (
                <div
                  key={image.id}
                  className={`rounded-[24px] border px-4 py-4 ${
                    status === "failed"
                      ? "border-[#efc1c1] bg-[#fff5f5]"
                      : status === "processing"
                        ? "border-primary bg-primary/6"
                        : status === "success"
                          ? "border-[#cde8d6] bg-[#f0faf4]"
                          : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="truncate text-sm font-medium text-ink">{image.name}</p>
                    <p className="text-xs text-muted">
                      {status === "failed" ? "失败" : status === "processing" ? "处理中" : status === "success" ? "成功" : "待处理"}
                    </p>
                  </div>
                  {status === "failed" ? (
                    <p className="mt-2 text-xs text-[#9a2020]">{failedPathMap.get(image.path)?.error ?? "未知错误"}</p>
                  ) : null}
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
                全部处理成功，可以打开输出目录查看结果，或清空工作区开始新任务。
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.98))] px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Next Step</p>
            <p className="mt-2 text-sm font-medium text-ink">
              {isAllSuccess
                ? "全部处理完成！打开输出目录查看结果，或开始下一批任务。"
                : isBatchRunning
                  ? "当前任务正在运行，建议先等待或取消任务。"
                  : "先处理结果，再决定是否继续下一批。"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {failedEntries.length > 0
                ? "有失败项时优先重试失败图片；全部成功时优先打开输出目录确认结果。"
                : isAllSuccess
                  ? "点击「打开输出目录」查看处理结果，或点击「开始新任务」清空工作区重新导入图片。"
                  : "没有失败项时，通常下一步就是打开输出目录查看结果。"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isBatchRunning ? (
              <button
                className="rounded-2xl border border-[#efc1c1] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#9a2020]"
                type="button"
                onClick={onCancelBatch}
              >
                取消任务
              </button>
            ) : null}
            {!isAllSuccess && failedEntries.length > 0 ? (
              <button
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                type="button"
                onClick={onRetryFailedOnly}
              >
                仅重试失败项
              </button>
            ) : null}
            {result?.outputDir ? (
              <button
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  isAllSuccess
                    ? "border border-[#cde8d6] bg-[#f0faf4] text-[#2d7a4e] hover:bg-[#e5f5ec]"
                    : "border border-line bg-white disabled:opacity-60"
                }`}
                type="button"
                onClick={onOpenOutputDir}
              >
                打开输出目录
              </button>
            ) : null}
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
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90"
              type="button"
              onClick={onBackHome}
            >
              {isAllSuccess ? "开始新任务" : "返回首页"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
