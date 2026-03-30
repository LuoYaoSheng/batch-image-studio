import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { AppScreen } from "../../types";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

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
  const [showShortcuts, setShowShortcuts] = useState(false);

  // 全局快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否在输入框中，如果是则不触发快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd/Ctrl + 数字键切换页面
      if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "4") {
        event.preventDefault();
        const screenMap: Record<string, AppScreen> = {
          "1": "home",
          "2": "builder",
          "3": "preview",
          "4": "batch",
        };
        onNavigate(screenMap[event.key]);
      }

      // Cmd/Ctrl + , 打开设置
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        onNavigate("settings");
      }

      // Cmd/Ctrl + / 显示快捷键帮助
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcuts(true);
      }

      // Esc 关闭对话框
      if (event.key === "Escape" && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, showShortcuts]);

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
      <SidebarNav currentScreen={currentScreen} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        {notification ? <div className="px-5 pt-4">{notification}</div> : null}
        <main className="min-w-0 flex-1 px-5 py-5">{children}</main>
      </div>
      <KeyboardShortcutsDialog isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
