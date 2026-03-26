import type { HistoryEntry } from "../types";
import { HistoryTable } from "../components/history/HistoryTable";

export function HistoryScreen({
  history,
  onReuse,
  onOpenOutputDir,
}: {
  history: HistoryEntry[];
  onReuse: (entry: HistoryEntry) => void;
  onOpenOutputDir: (entry: HistoryEntry) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">History</p>
        <h3 className="mt-2 text-2xl font-semibold text-ink">历史记录</h3>
        <p className="mt-2 text-sm text-muted">重点是快速找到以前做过的任务并再次使用对应模板。</p>
      </section>

      <HistoryTable history={history} onReuse={onReuse} onOpenOutputDir={onOpenOutputDir} />
    </div>
  );
}
