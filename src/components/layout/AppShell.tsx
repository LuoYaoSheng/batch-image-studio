import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { AppScreen, Toast, WorkflowStep } from "../../types";
import { SidebarNav } from "./SidebarNav";
import { StepperBar } from "./StepperBar";
import { TopBar } from "./TopBar";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ToastContainer } from "../feedback";

export function AppShell({
  currentScreen,
  onNavigate,
  onImportFiles,
  title,
  subtitle,
  actions,
  notification,
  toasts = [],
  onRemoveToast,
  children,
  onShortcutSaveTemplate,
  onShortcutDeleteImage,
  // Workspace mode props
  variant = "sidebar",
  workflowStep,
  onStepClick,
  onOpenTemplates,
  onOpenHistory,
  onOpenSettings,
}: {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onImportFiles?: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  notification?: ReactNode;
  toasts?: Toast[];
  onRemoveToast?: (id: string) => void;
  children: ReactNode;
  onShortcutSaveTemplate?: () => void;
  onShortcutDeleteImage?: () => void;
  // Workspace mode props
  variant?: "sidebar" | "workspace";
  workflowStep?: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
  onOpenTemplates?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
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

      if (variant === "workspace") {
        // 工作区模式快捷键
        // Cmd/Ctrl + 数字键切换步骤
        if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "4") {
          event.preventDefault();
          const stepMap: Record<string, WorkflowStep> = {
            "1": "idle",
            "2": "select",
            "3": "preview",
            "4": "process",
          };
          onStepClick?.(stepMap[event.key]);
        }

        // Cmd/Ctrl + O 导入图片
        if ((event.metaKey || event.ctrlKey) && event.key === "o") {
          event.preventDefault();
          onImportFiles?.();
        }

        // Cmd/Ctrl + T 打开模板
        if ((event.metaKey || event.ctrlKey) && event.key === "t") {
          event.preventDefault();
          onOpenTemplates?.();
        }

        // Cmd/Ctrl + H 打开历史
        if ((event.metaKey || event.ctrlKey) && event.key === "h") {
          event.preventDefault();
          onOpenHistory?.();
        }

        // Cmd/Ctrl + , 打开设置
        if ((event.metaKey || event.ctrlKey) && event.key === ",") {
          event.preventDefault();
          onOpenSettings?.();
        }
      } else {
        // 侧边栏模式快捷键
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

        // Cmd/Ctrl + O 导入图片
        if ((event.metaKey || event.ctrlKey) && event.key === "o") {
          event.preventDefault();
          onImportFiles?.();
        }

        // Cmd/Ctrl + S 保存模板
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          onShortcutSaveTemplate?.();
        }

        // Delete/Backspace 删除当前图片
        if ((event.key === "Delete" || event.key === "Backspace") && onShortcutDeleteImage) {
          event.preventDefault();
          onShortcutDeleteImage();
        }

        // Cmd/Ctrl + , 打开设置
        if ((event.metaKey || event.ctrlKey) && event.key === ",") {
          event.preventDefault();
          onNavigate("settings");
        }
      }

      // Cmd/Ctrl + / 显示快捷键帮助（两种模式通用）
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Esc 关闭对话框
      if (event.key === "Escape" && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, onImportFiles, onOpenTemplates, onOpenHistory, onOpenSettings, onStepClick, showShortcuts, variant, onShortcutSaveTemplate, onShortcutDeleteImage]);

  if (variant === "workspace") {
    return (
      <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
        <StepperBar
          currentStep={workflowStep ?? "idle"}
          onStepClick={onStepClick ?? (() => {})}
          onOpenTemplates={onOpenTemplates ?? (() => {})}
          onOpenHistory={onOpenHistory ?? (() => {})}
          onOpenSettings={onOpenSettings ?? (() => {})}
        />
        {notification ? <div className="px-5 pt-4">{notification}</div> : null}
        <main className="min-w-0 flex-1 px-5 py-5">{children}</main>
        <KeyboardShortcutsDialog isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} variant="workspace" />
        {onRemoveToast && (
          <ToastContainer toasts={toasts} onRemoveToast={onRemoveToast} />
        )}
      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
      <SidebarNav currentScreen={currentScreen} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar currentScreen={currentScreen} title={title} subtitle={subtitle} actions={actions} />
        {notification ? <div className="px-5 pt-4">{notification}</div> : null}
        <main className="min-w-0 flex-1 px-5 py-5">{children}</main>
      </div>
      <KeyboardShortcutsDialog isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} variant="sidebar" />
      {onRemoveToast && (
        <ToastContainer toasts={toasts} onRemoveToast={onRemoveToast} />
      )}
    </div>
  );
}
