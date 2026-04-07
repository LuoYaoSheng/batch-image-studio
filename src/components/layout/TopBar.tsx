import type { ReactNode } from "react";
import type { AppScreen } from "../../types";

const STEPS = [
  { id: "home" as AppScreen, num: 1, label: "导入" },
  { id: "builder" as AppScreen, num: 2, label: "选区" },
  { id: "preview" as AppScreen, num: 3, label: "预览" },
  { id: "batch" as AppScreen, num: 4, label: "批量" },
];

export function TopBar({
  currentScreen,
  title,
  subtitle,
  actions,
}: {
  currentScreen: AppScreen;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  // 获取当前步骤索引
  const getCurrentStepIndex = () => {
    const index = STEPS.findIndex((s) => s.id === currentScreen);
    return index >= 0 ? index : 0;
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <header className="flex min-h-[60px] flex-col justify-center border-b border-line bg-white/88 px-6 backdrop-blur">
      {/* 步骤进度条 */}
      <div className="flex items-center gap-1 mb-3">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isClickable = index <= currentIndex + 1;

          return (
            <div key={step.id} className="flex items-center">
              <button
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition ${
                  isCurrent
                    ? "bg-primary text-white"
                    : isCompleted
                      ? "bg-success/10 text-success hover:bg-success/20"
                      : "bg-surface text-muted"
                } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                type="button"
                disabled={!isClickable}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current text-white text-[10px] font-semibold">
                  {isCompleted ? "✓" : step.num}
                </span>
                <span>{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={`h-px w-8 mx-1 ${isCompleted ? "bg-success/50" : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* 标题区域 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
