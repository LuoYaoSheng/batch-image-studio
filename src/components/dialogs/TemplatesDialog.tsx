import { TemplatesScreen } from "../../screens/TemplatesScreen";

export function TemplatesDialog({
  isOpen,
  onClose,
  templates,
  onApply,
  onEdit,
  onDelete,
  onCreateNew,
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: Parameters<typeof TemplatesScreen>[0]["templates"];
  onApply: Parameters<typeof TemplatesScreen>[0]["onApply"];
  onEdit: Parameters<typeof TemplatesScreen>[0]["onEdit"];
  onDelete: Parameters<typeof TemplatesScreen>[0]["onDelete"];
  onCreateNew: Parameters<typeof TemplatesScreen>[0]["onCreateNew"];
}) {
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
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Templates</p>
            <h3 className="mt-1 text-xl font-semibold text-ink">模板中心</h3>
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
          <TemplatesScreen
            templates={templates}
            onApply={(id) => {
              onApply(id);
            }}
            onEdit={(id) => {
              onEdit(id);
            }}
            onDelete={onDelete}
            onCreateNew={() => {
              onCreateNew();
            }}
          />
        </div>
      </div>
    </div>
  );
}
