import type { ReactNode } from "react";

export type DecisionDialogAction = {
  label: string;
  tone?: "primary" | "danger" | "neutral";
  onClick: () => void;
};

export function DecisionDialog({
  title,
  description,
  secondaryAction,
  cancelAction,
  primaryAction,
}: {
  title: string;
  description: ReactNode;
  secondaryAction?: DecisionDialogAction;
  cancelAction: DecisionDialogAction;
  primaryAction: DecisionDialogAction;
}) {
  const buttonClass = {
    primary: "bg-primary text-white",
    danger: "bg-[#9a2020] text-white",
    neutral: "border border-line bg-white text-ink",
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/25 px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-[28px] border border-line bg-white p-6 shadow-ambient">
        <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">确认操作</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">{title}</h3>
        <div className="mt-4 text-sm leading-7 text-muted">{description}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {secondaryAction ? (
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${buttonClass[secondaryAction.tone ?? "neutral"]}`}
              type="button"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${buttonClass[cancelAction.tone ?? "neutral"]}`}
            type="button"
            onClick={cancelAction.onClick}
          >
            {cancelAction.label}
          </button>
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${buttonClass[primaryAction.tone ?? "primary"]}`}
            type="button"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}
