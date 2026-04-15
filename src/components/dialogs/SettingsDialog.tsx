import { SettingsScreen } from "../../screens/SettingsScreen";

export function SettingsDialog({
  isOpen,
  onClose,
  ...settingsProps
}: {
  isOpen: boolean;
  onClose: () => void;
} & Parameters<typeof SettingsScreen>[0]) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 px-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-[28px] border border-line bg-white shadow-ambient"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Settings</p>
            <h3 className="mt-1 text-xl font-semibold text-ink">默认设置</h3>
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
          <SettingsScreen {...settingsProps} />
        </div>
      </div>
    </div>
  );
}
