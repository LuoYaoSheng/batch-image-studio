import type { ReactNode } from "react";

export function TopBar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-[72px] items-center justify-between border-b border-line bg-white/88 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Workspace</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
