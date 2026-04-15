import type { WorkflowStep } from "../../types";

const STEPS: Array<{ id: WorkflowStep; label: string; number: string }> = [
  { id: "idle", label: "导入", number: "1" },
  { id: "select", label: "调整", number: "2" },
  { id: "preview", label: "预览", number: "3" },
  { id: "process", label: "处理", number: "4" },
];

const STEP_ORDER: Record<WorkflowStep, number> = {
  idle: 0,
  select: 1,
  preview: 2,
  process: 3,
};

export function StepperBar({
  currentStep,
  onStepClick,
  onOpenTemplates,
  onOpenHistory,
  onOpenSettings,
}: {
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}) {
  const currentIndex = STEP_ORDER[currentStep];

  return (
    <div className="flex items-center justify-between border-b border-line bg-white/88 px-6 py-3 backdrop-blur">
      {/* 左侧：应用标识 */}
      <div className="flex items-center gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Batch Image Studio</p>
      </div>

      {/* 中间：步骤条 */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isClickable = isCompleted;

          return (
            <div key={step.id} className="flex items-center">
              {index > 0 ? (
                <div className={`mx-2 h-px w-6 ${index <= currentIndex ? "bg-primary" : "bg-line"}`} />
              ) : null}
              <button
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary text-white"
                    : isCompleted
                      ? "text-primary hover:bg-primary/5 cursor-pointer"
                      : "text-muted cursor-default"
                }`}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isCompleted
                        ? "bg-primary/10 text-primary"
                        : "bg-surface text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 右侧：工具图标 */}
      <div className="flex items-center gap-1">
        <button
          className="rounded-xl p-2 text-muted hover:bg-surface hover:text-ink transition-colors"
          type="button"
          onClick={onOpenTemplates}
          title="常用做法 (⌘T)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button
          className="rounded-xl p-2 text-muted hover:bg-surface hover:text-ink transition-colors"
          type="button"
          onClick={onOpenHistory}
          title="处理记录 (⌘H)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
        <button
          className="rounded-xl p-2 text-muted hover:bg-surface hover:text-ink transition-colors"
          type="button"
          onClick={onOpenSettings}
          title="设置 (⌘,)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
