import type { Template } from "../../types";
import {
  formatRelativeTime,
  getCleanupMethodLabel,
  getSizeHandlingModeLabel,
  getTemplateTimestamp,
} from "../../lib/formatting";
import { resolveTemplatePreviewSrc } from "../../lib/templatePreview";

export function TemplateCard({
  template,
  onApply,
  onEdit,
  onDelete,
}: {
  template: Template;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const previewSrc = resolveTemplatePreviewSrc(template.previewImage);

  return (
    <article className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-ink">{template.name}</p>
          <p className="mt-2 text-sm text-muted">
            {getCleanupMethodLabel(template.cleanupMethod)} · {getSizeHandlingModeLabel(template.sizeHandlingMode)}
          </p>
          <p className="mt-2 text-xs text-muted">
            最近更新 {formatRelativeTime(getTemplateTimestamp(template))}
          </p>
        </div>
        {previewSrc ? (
          <img
            alt={template.name}
            className="h-20 w-20 rounded-2xl border border-line object-cover"
            decoding="async"
            loading="lazy"
            src={previewSrc}
          />
        ) : null}
      </div>

      <div className="mt-5 flex gap-3">
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
          type="button"
          onClick={onApply}
        >
          应用模板
        </button>
        <button
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium"
          type="button"
          onClick={onEdit}
        >
          编辑
        </button>
        <button
          className="rounded-xl border border-[#efc1c1] bg-[#fff5f5] px-4 py-2 text-sm font-medium text-[#9a2020]"
          type="button"
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </article>
  );
}
