import type { HistoryEntry, Template } from "../types";
import { formatDateTime, formatRelativeTime, getHistoryTemplateLabel, getTemplateTimestamp } from "../lib/formatting";
import { ModelStatusIndicator } from "../components/ModelStatusIndicator";

export function HomeScreen({
  templates,
  history,
  isImporting,
  isModelLoaded,
  isModelLoading,
  isModelFailed,
  modelLoadProgress,
  onImportFiles,
  onImportFolder,
  onOpenTemplates,
  onUseTemplate,
  onOpenHistory,
  onRetryModelLoad,
}: {
  templates: Template[];
  history: HistoryEntry[];
  isImporting: boolean;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  isModelFailed: boolean;
  modelLoadProgress: number;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onOpenTemplates: () => void;
  onUseTemplate: (id: string) => void;
  onOpenHistory: () => void;
  onRetryModelLoad?: () => void;
}) {
  const recentTemplates = [...templates]
    .sort((a, b) => {
      const left = getTemplateTimestamp(a) ?? "";
      const right = getTemplateTimestamp(b) ?? "";
      return right.localeCompare(left);
    })
    .slice(0, 3);
  const recentHistory = history.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* 模型状态指示器 */}
      <div className="flex justify-center">
        <ModelStatusIndicator
          isLoaded={isModelLoaded}
          isLoading={isModelLoading}
          isFailed={isModelFailed}
          progress={modelLoadProgress}
          onRetry={onRetryModelLoad}
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.06),_rgba(255,255,255,0.96))] p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.28em] text-primary-strong">Start</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">拖入图片或文件夹，开始创建模板任务</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            第一次使用时，只需要导入图片、选样图、框选区域、预览并保存模板。后续同类图片可以直接复用模板快速批量处理。
          </p>

          <div className="mt-6 rounded-[24px] border border-dashed border-primary/30 bg-white/90 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-ink">拖拽图片或文件夹到此处开始</p>
            <p className="mt-2 text-sm text-muted">支持 JPG、PNG、WEBP 等常见格式。当前处理全部在本地完成。</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                type="button"
                disabled={isImporting}
                onClick={onImportFiles}
              >
                {isImporting ? "导入中..." : "导入图片"}
              </button>
              <button
                className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium disabled:opacity-60"
                type="button"
                disabled={isImporting}
                onClick={onImportFolder}
              >
                导入文件夹
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Template First</p>
          <h3 className="mt-3 text-2xl font-semibold text-ink">应用已有模板</h3>
          <p className="mt-3 text-sm leading-7 text-muted">
            已有可复用模板时，先选择模板进入模板构建页查看参数，再决定导入图片或直接继续当前任务。
          </p>
          <button
            className="mt-6 w-full rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-primary-strong"
            type="button"
            onClick={onOpenTemplates}
          >
            选择模板
          </button>
          {recentTemplates.length > 0 ? (
            <div className="mt-5 space-y-3">
              {recentTemplates.map((template) => (
                <button
                  key={template.id}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left"
                  type="button"
                  onClick={() => onUseTemplate(template.id)}
                >
                  <p className="text-sm font-medium text-ink">{template.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    最近更新 {formatRelativeTime(getTemplateTimestamp(template))}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
              还没有模板。完成第一次处理并保存模板后，这里会出现快捷入口。
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Recent Templates</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">最近模板</h3>
            </div>
            <button className="text-sm font-medium text-primary" type="button" onClick={onOpenTemplates}>
              查看全部
            </button>
          </div>

          {recentTemplates.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line bg-surface px-5 py-10 text-sm text-muted">
              暂无模板，建议先导入一批图片，框选区域并保存第一个模板。
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentTemplates.map((template) => (
                <button
                  key={template.id}
                  className="rounded-[24px] border border-line bg-surface p-4 text-left transition hover:border-primary-strong"
                  type="button"
                  onClick={() => onUseTemplate(template.id)}
                >
                  <p className="text-base font-semibold text-ink">{template.name}</p>
                  <p className="mt-2 text-sm text-muted">{formatRelativeTime(getTemplateTimestamp(template))}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Recent Tasks</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">最近任务</h3>
            </div>
            <button className="text-sm font-medium text-primary" type="button" onClick={onOpenHistory}>
              查看历史记录
            </button>
          </div>

          {recentHistory.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line bg-surface px-5 py-10 text-sm text-muted">
              还没有历史任务。完成一次批量处理后，这里会出现结果摘要和复用入口。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentHistory.map((entry) => (
                <div key={entry.id} className="rounded-[24px] border border-line bg-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{getHistoryTemplateLabel(entry)}</p>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <p className="text-xs text-muted">{entry.importedCount} 张</p>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    成功 {entry.successCount} / 失败 {entry.failedCount}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
