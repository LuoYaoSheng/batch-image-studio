import type { Template, HistoryEntry } from "../types";
import {
  formatDateTime,
  formatRelativeTime,
  getHistoryTemplateLabel,
  getTemplateTimestamp,
} from "../lib/formatting";
import { ModelStatusIndicator } from "../components/ModelStatusIndicator";

export function IdleDropZone({
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
  onUseTemplate,
  onOpenTemplates,
  onOpenHistory,
  onOpenModelDir,
  onDownloadModel,
  onImportModelPackage,
  onOpenOfficialModelInfo,
  onRetryModelLoad,
  onOpenSettings,
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
  onUseTemplate: (id: string) => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenModelDir: () => void;
  onDownloadModel: () => void;
  onImportModelPackage: () => void;
  onOpenOfficialModelInfo: () => void;
  onRetryModelLoad?: () => void;
  onOpenSettings?: () => void;
}) {
  const recentTemplates = [...templates]
    .sort((a, b) => {
      const left = getTemplateTimestamp(a) ?? "";
      const right = getTemplateTimestamp(b) ?? "";
      return right.localeCompare(left);
    })
    .slice(0, 3);
  const recentHistory = history.slice(0, 3);

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center p-8">
      <div className="w-full max-w-3xl space-y-6">
        {/* 模型状态 */}
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

        {/* 模型未安装提示 */}
        {hasCheckedModelStatus && !isModelAvailable ? (
          <section className="rounded-[24px] border border-[#f0d8a8] bg-[#fff6df] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#8a5b00]">当前还没有安装智能修复模型</p>
                <p className="mt-1 text-xs text-[#8a5b00]">
                  先下载模型包，再点击"导入模型包"，以后就能一直使用预览和批量智能修复。
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
              </div>
            </div>
          </section>
        ) : null}

        {/* 主拖拽区 */}
        <div className="rounded-[28px] border-2 border-dashed border-primary/30 bg-[linear-gradient(180deg,_rgba(0,95,184,0.06),_rgba(255,255,255,0.98))] p-12 text-center shadow-sm animate-[breathe_4s_ease-in-out_infinite]">
          <p className="text-2xl font-semibold text-ink">拖拽图片或文件夹到这里开始</p>
          <p className="mt-3 text-sm text-muted">支持 JPG、PNG、WEBP。所有处理都在本地完成。</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              className="rounded-2xl bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
              type="button"
              disabled={isImporting}
              onClick={onImportFiles}
            >
              {isImporting ? "导入中..." : "导入图片"}
            </button>
            <button
              className="rounded-2xl border border-line bg-white px-6 py-3 text-sm font-medium disabled:opacity-60"
              type="button"
              disabled={isImporting}
              onClick={onImportFolder}
            >
              导入文件夹
            </button>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* 最近模板 */}
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Recent Templates</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">最近做法</h3>
              </div>
              <button className="text-sm font-medium text-primary" type="button" onClick={onOpenTemplates}>
                查看全部
              </button>
            </div>
            {recentTemplates.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-line bg-surface px-4 py-6 text-sm text-muted">
                暂无做法，建议先导入一批图片，框选区域并保存第一个模板。
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {recentTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="w-full rounded-[20px] border border-line bg-surface px-4 py-3 text-left transition hover:border-primary-strong"
                    type="button"
                    onClick={() => onUseTemplate(template.id)}
                  >
                    <p className="text-sm font-medium text-ink">{template.name}</p>
                    <p className="mt-1 text-xs text-muted">{formatRelativeTime(getTemplateTimestamp(template))}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 最近历史 */}
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Recent Tasks</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">最近结果</h3>
              </div>
              <button className="text-sm font-medium text-primary" type="button" onClick={onOpenHistory}>
                查看历史记录
              </button>
            </div>
            {recentHistory.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-line bg-surface px-4 py-6 text-sm text-muted">
                还没有历史任务。完成一次批量处理后，这里会出现结果摘要和复用入口。
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {recentHistory.map((entry) => (
                  <div key={entry.id} className="rounded-[20px] border border-line bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{getHistoryTemplateLabel(entry)}</p>
                        <p className="mt-1 text-xs text-muted">{formatDateTime(entry.createdAt)}</p>
                      </div>
                      <p className="text-xs text-muted">{entry.importedCount} 张</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 设置图标 */}
        {onOpenSettings ? (
          <div className="flex justify-end">
            <button
              className="rounded-xl border border-line bg-surface p-2.5 text-muted hover:bg-white hover:text-ink transition-colors"
              type="button"
              onClick={onOpenSettings}
              title="设置"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
