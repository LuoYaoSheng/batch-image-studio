import { useDeferredValue, useState } from "react";
import type { Template } from "../../types";
import { formatRelativeTime, getCleanupMethodLabel, getTemplateTimestamp } from "../../lib/formatting";

export function TemplatePickerDialog({
  templates,
  title = "选择模板",
  description = "先选择一个模板，再进入模板构建或继续当前任务。",
  onSelect,
  onManageTemplates,
  onClose,
}: {
  templates: Template[];
  title?: string;
  description?: string;
  onSelect: (id: string) => void;
  onManageTemplates: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filtered = templates.filter((template) =>
    template.name.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-3xl rounded-[28px] border border-line bg-white p-6 shadow-ambient">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Template Picker</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
          <button
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium text-ink">搜索模板</span>
          <input
            className="h-11 w-full rounded-xl border border-line bg-surface px-3"
            placeholder="按模板名称搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
              当前没有匹配的模板。
            </div>
          ) : (
            filtered.map((template) => (
              <button
                key={template.id}
                className="w-full rounded-[24px] border border-line bg-surface px-5 py-4 text-left transition hover:border-primary-strong hover:bg-white"
                type="button"
                onClick={() => onSelect(template.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-ink">{template.name}</p>
                    <p className="mt-2 text-sm text-muted">
                      {getCleanupMethodLabel(template.cleanupMethod)} · {template.sizeHandlingMode}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      最近更新 {formatRelativeTime(getTemplateTimestamp(template))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white">应用</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium"
            type="button"
            onClick={onManageTemplates}
          >
            打开模板中心
          </button>
          <button
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white"
            type="button"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
