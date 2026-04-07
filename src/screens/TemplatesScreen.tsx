import { useDeferredValue, useState } from "react";
import type { Template } from "../types";
import { TemplateCard } from "../components/templates/TemplateCard";
import { DecisionDialog } from "../components/layout/DecisionDialog";

export function TemplatesScreen({
  templates,
  onApply,
  onEdit,
  onDelete,
  onCopy,
  onCreateNew,
}: {
  templates: Template[];
  onApply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy?: (id: string) => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<Template | null>(null);
  const deferredQuery = useDeferredValue(query);
  const filtered = templates.filter((template) =>
    template.name.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );

  const handleDeleteClick = (template: Template) => {
    setPendingDeleteTemplate(template);
  };

  const confirmDelete = () => {
    if (pendingDeleteTemplate) {
      onDelete(pendingDeleteTemplate.id);
      setPendingDeleteTemplate(null);
    }
  };

  const cancelDelete = () => {
    setPendingDeleteTemplate(null);
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4 rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Templates</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">模板中心</h3>
          <p className="mt-2 text-sm text-muted">这里的模板只用于局部区域批量处理，不承载通用修图工作流。</p>
        </div>
        <button
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white"
          type="button"
          onClick={onCreateNew}
        >
          新建模板
        </button>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">搜索模板</span>
          <input
            className="h-11 w-full rounded-xl border border-line bg-surface px-3"
            placeholder="按模板名称搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-line bg-white px-8 py-14 text-center text-sm text-muted">
          暂无模板。完成一次构建并保存后，这里会显示可复用模板。
        </div>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onApply={() => onApply(template.id)}
              onEdit={() => onEdit(template.id)}
              onCopy={onCopy ? () => onCopy(template.id) : undefined}
              onDelete={() => handleDeleteClick(template)}
            />
          ))}
        </section>
      )}

      {/* 删除确认对话框 */}
      {pendingDeleteTemplate && (
        <DecisionDialog
          title="确认删除模板"
          description={
            <span>
              确定要删除模板 <strong>"{pendingDeleteTemplate.name}"</strong> 吗？
              <br />
              此操作无法撤销。
            </span>
          }
          cancelAction={{ label: "取消", onClick: cancelDelete }}
          primaryAction={{ label: "确认删除", tone: "danger", onClick: confirmDelete }}
        />
      )}
    </div>
  );
}
