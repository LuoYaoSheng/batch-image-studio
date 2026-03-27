import type { HistoryEntry } from "../../types";
import { formatDateTime, getHistoryTemplateLabel } from "../../lib/formatting";

export function HistoryTable({
  history,
  onReuse,
  onOpenOutputDir,
}: {
  history: HistoryEntry[];
  onReuse: (entry: HistoryEntry) => void;
  onOpenOutputDir: (entry: HistoryEntry) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        暂无历史任务，完成一次批量处理后会显示在这里。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-low text-xs uppercase tracking-[0.18em] text-muted">
          <tr>
            <th className="px-5 py-4">任务时间</th>
            <th className="px-5 py-4">模板</th>
            <th className="px-5 py-4">图片数量</th>
            <th className="px-5 py-4">结果摘要</th>
            <th className="px-5 py-4">输出目录</th>
            <th className="px-5 py-4 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id} className="border-t border-line/70">
              <td className="px-5 py-4 text-sm text-ink">{formatDateTime(entry.createdAt)}</td>
              <td className="px-5 py-4 text-sm text-ink">{getHistoryTemplateLabel(entry)}</td>
              <td className="px-5 py-4 text-sm text-ink">{entry.importedCount} 张</td>
              <td className="px-5 py-4 text-sm text-muted">
                成功 {entry.successCount} / 失败 {entry.failedCount}
              </td>
              <td className="max-w-[260px] truncate px-5 py-4 text-sm text-muted">{entry.outputDir}</td>
              <td className="px-5 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium"
                    type="button"
                    onClick={() => onOpenOutputDir(entry)}
                  >
                    打开目录
                  </button>
                  <button
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
                    type="button"
                    onClick={() => onReuse(entry)}
                  >
                    复用
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
