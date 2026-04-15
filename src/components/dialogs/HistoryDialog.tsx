import type { HistoryEntry } from "../../types";
import { HistoryScreen } from "../../screens/HistoryScreen";

export function HistoryDialog({
  isOpen,
  onClose,
  history,
  onReuse,
  onOpenOutputDir,
}: {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onReuse: (entry: HistoryEntry) => void;
  onOpenOutputDir: (entry: HistoryEntry) => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 px-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-[28px] border border-line bg-white shadow-ambient"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">History</p>
            <h3 className="mt-1 text-xl font-semibold text-ink">历史记录</h3>
          </div>
          <button
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-white transition-colors"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <HistoryScreen
            history={history}
            onReuse={(entry) => {
              onReuse(entry);
            }}
            onOpenOutputDir={onOpenOutputDir}
          />
        </div>
      </div>
    </div>
  );
}
