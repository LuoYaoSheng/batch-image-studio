import type { HistoryEntry, Template } from "../types";
import {
  formatDateTime,
  formatRelativeTime,
  getHistoryTemplateLabel,
  getTemplateTimestamp,
} from "../lib/formatting";
import { ModelStatusIndicator } from "../components/ModelStatusIndicator";

export function HomeScreen({
  templates,
  history,
  isImporting,
  hasCheckedModelStatus,
  isModelAvailable,
  isModelLoaded,
  isModelLoading,
  isModelFailed,
  preferredModelSource,
  modelLoadProgress,
  onImportFiles,
  onImportFolder,
  onOpenTemplates,
  onUseTemplate,
  onOpenHistory,
  onOpenModelDir,
  onDownloadModel,
  onImportModelPackage,
  onOpenOfficialModelInfo,
  onRetryModelLoad,
}: {
  templates: Template[];
  history: HistoryEntry[];
  isImporting: boolean;
  hasCheckedModelStatus: boolean;
  isModelAvailable: boolean;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  isModelFailed: boolean;
  preferredModelSource: "local" | "bundled" | null;
  modelLoadProgress: number;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onOpenTemplates: () => void;
  onUseTemplate: (id: string) => void;
  onOpenHistory: () => void;
  onOpenModelDir: () => void;
  onDownloadModel: () => void;
  onImportModelPackage: () => void;
  onOpenOfficialModelInfo: () => void;
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
  const hasOnlyStarterTemplates =
    templates.length > 0 && templates.every((template) => template.id.startsWith("starter-"));
  const isFirstTimeUser = history.length === 0 && (templates.length === 0 || hasOnlyStarterTemplates);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <ModelStatusIndicator
          hasCheckedStatus={hasCheckedModelStatus}
          isAvailable={isModelAvailable}
          isLoaded={isModelLoaded}
          isLoading={isModelLoading}
          isFailed={isModelFailed}
          preferredModelSource={preferredModelSource}
          progress={modelLoadProgress}
          onRetry={onRetryModelLoad}
          onOpenModelDir={onOpenModelDir}
          onDownloadModel={onDownloadModel}
        />
      </div>

      {hasCheckedModelStatus && !isModelAvailable ? (
        <section className="rounded-[24px] border border-[#f0d8a8] bg-[#fff6df] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#8a5b00]">当前还没有安装智能修复模型</p>
              <p className="mt-1 text-xs text-[#8a5b00]">
                先下载模型包，再点击“导入模型包”，以后就能一直使用预览和批量智能修复。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
                type="button"
                onClick={onDownloadModel}
              >
                下载并安装
              </button>
              <button
                className="rounded-2xl border border-primary bg-white px-4 py-2.5 text-sm font-medium text-primary"
                type="button"
                onClick={onImportModelPackage}
              >
                导入模型包
              </button>
              <button
                className="rounded-2xl border border-[#f0d8a8] bg-white px-4 py-2.5 text-sm font-medium text-primary"
                type="button"
                onClick={onOpenOfficialModelInfo}
              >
                官方项目
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid min-h-[780px] grid-rows-[minmax(0,1fr)_auto] gap-4">
        <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_332px]">
          <div className="min-h-0 space-y-4">
            <div className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.06),_rgba(255,255,255,0.98))] p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-primary-strong">Start</p>
              <h2 className="mt-3 text-3xl font-semibold text-ink">先导入图片，再一步步完成处理</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                第一次使用时，只需要导入图片、选样图、框选区域、看预览并保存做法。后续同类图片可以直接复用。
              </p>

              <div className="mt-6 rounded-[24px] border border-dashed border-primary/30 bg-white/90 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-ink">拖拽图片或文件夹到这里开始</p>
                <p className="mt-2 text-sm text-muted">支持 JPG、PNG、WEBP。所有处理都在本地完成。</p>
              </div>
            </div>

            <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Recent Templates</p>
                    <h3 className="mt-2 text-2xl font-semibold text-ink">最近做法</h3>
                  </div>
                  <button className="text-sm font-medium text-primary" type="button" onClick={onOpenTemplates}>
                    查看全部
                  </button>
                </div>

                {recentTemplates.length === 0 ? (
                  <div className="mt-5 rounded-[24px] border border-dashed border-line bg-surface px-5 py-10 text-sm text-muted">
                    暂无做法，建议先导入一批图片，框选区域并保存第一个模板。
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                    <h3 className="mt-2 text-2xl font-semibold text-ink">最近结果</h3>
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
            </div>
          </div>

          <aside className="space-y-4">
            {isFirstTimeUser ? (
              <div className="rounded-[28px] border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">快速开始</p>
                <h3 className="mt-3 text-xl font-semibold text-ink">第一次处理只要 4 步</h3>
                <div className="mt-5 space-y-3">
                  {[
                    { step: "1", title: "导入图片", desc: "选择需要处理的一组图片" },
                    { step: "2", title: "框选区域", desc: "在样图上拖动选择要处理的区域" },
                    { step: "3", title: "确认效果", desc: "先看预览是否符合预期" },
                    { step: "4", title: "保存做法", desc: "下次同类图片可以直接复用" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4 rounded-2xl bg-white/80 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Template First</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">直接套用常用做法</h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                如果这批图片和以前处理过的很像，直接选一个做法，通常会更快。
              </p>
              <button
                className="mt-6 w-full rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-primary-strong"
                type="button"
                onClick={onOpenTemplates}
              >
                选择做法
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
          </aside>
        </section>

        <section className="rounded-[28px] border border-primary/20 bg-[linear-gradient(180deg,_rgba(0,95,184,0.05),_rgba(255,255,255,0.98))] px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary-strong">Primary Action</p>
              <p className="mt-2 text-sm font-medium text-ink">先把图片放进来，后面的步骤应用会一步步带你走</p>
              <p className="mt-1 text-xs text-muted">如果不确定，先导入图片；如果已经有做法，再选“选择做法”。</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium disabled:opacity-60"
                type="button"
                disabled={isImporting}
                onClick={onImportFolder}
              >
                导入文件夹
              </button>
              <button
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                type="button"
                disabled={isImporting}
                onClick={onImportFiles}
              >
                {isImporting ? "导入中..." : "导入图片"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
