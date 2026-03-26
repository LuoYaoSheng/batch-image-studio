import type { ReactNode } from "react";
import type { AppScreen } from "../../types";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";

export function AppShell({
  currentScreen,
  onNavigate,
  title,
  subtitle,
  actions,
  notification,
  children,
}: {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  notification?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
      <SidebarNav currentScreen={currentScreen} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        {notification ? <div className="px-6 pt-4">{notification}</div> : null}
        <main className="min-w-0 flex-1 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
