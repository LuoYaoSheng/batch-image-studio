import { useCallback, useEffect, useRef, useState } from "react";
import { startTransition } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ImportSummary } from "../types";
import { useWorkspaceStore } from "../store/workspace";

// ---------------------------------------------------------------------------
// Helpers (previously defined at module level in App.tsx)
// ---------------------------------------------------------------------------

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalizePaths(paths: string[]) {
  return [...paths].sort().join("::");
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function waitForNextTask() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

async function waitForUiCommit() {
  await waitForNextPaint();
  await waitForNextTask();
  await waitForNextPaint();
}

const supportedFilters = [
  {
    name: "Images",
    extensions: ["png", "jpg", "jpeg", "webp"],
  },
];

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export type DragOverlayState = "idle" | "hover" | "importing";

export interface UseImageImportOptions {
  /** Called right before a "replace" import starts, allowing the consumer to clear local caches. */
  onBeforeReplaceImport?: () => void;
  /** Called after a successful import when the destination screen should be entered. */
  onNavigateToDestination?: (destination: "builder" | "preview") => void;
}

export interface UseImageImportReturn {
  /** Whether an import operation is currently in progress. */
  isImporting: boolean;
  /** Current drag-overlay visual state. */
  dragOverlayState: DragOverlayState;
  /** Open a native file-picker dialog and import selected files. */
  importWithDialog: (mode: "files" | "folder", strategy?: "replace" | "append") => Promise<void>;
  /** Import an array of file-system paths directly. */
  importPaths: (paths: string[], strategy?: "replace" | "append") => Promise<void>;
  /** High-level entry point: sets destination + optional new session, then opens dialog. */
  startImportFlow: (
    mode: "files" | "folder",
    destination: "builder" | "preview",
    strategy?: "replace" | "append",
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useImageImport(options?: UseImageImportOptions): UseImageImportReturn {
  const [isImporting, setIsImporting] = useState(false);
  const [dragOverlayState, setDragOverlayState] = useState<DragOverlayState>("idle");

  const lastImportSignatureRef = useRef("");
  const lastImportAtRef = useRef(0);
  const dragSessionLockedRef = useRef(false);

  // [Patch #2] Store options in ref to avoid useCallback dependency churn
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Store actions
  const applyImportSummary = useWorkspaceStore((s) => s.applyImportSummary);
  const appendImportSummary = useWorkspaceStore((s) => s.appendImportSummary);
  const setCurrentScreen = useWorkspaceStore((s) => s.setCurrentScreen);
  const setPendingImportDestination = useWorkspaceStore((s) => s.setPendingImportDestination);
  const startNewTemplateSession = useWorkspaceStore((s) => s.startNewTemplateSession);
  const setNotification = useWorkspaceStore((s) => s.setNotification);
  const setImporting = useWorkspaceStore((s) => s.setImporting);

  // ---------------------------------------------------------------------------
  // importPaths – core import logic
  // ---------------------------------------------------------------------------

  const importPathsFn = useCallback(
    async (paths: string[], strategy: "replace" | "append" = "replace") => {
      const signature = normalizePaths(paths);
      const now = Date.now();
      if (signature.length > 0 && signature === lastImportSignatureRef.current && now - lastImportAtRef.current < 1500) {
        return;
      }

      lastImportSignatureRef.current = signature;
      lastImportAtRef.current = now;

      // [Patch #2] Read options from ref (stable reference)
      if (strategy === "replace") {
        optionsRef.current?.onBeforeReplaceImport?.();
      }

      let summary: ImportSummary;
      try {
        summary = await invoke<ImportSummary>("import_paths", { paths });
      } catch (error) {
        // [Patch #5] Reset dedup signature on invoke failure so retry is not blocked
        lastImportSignatureRef.current = "";
        throw error;
      }

      const destination = useWorkspaceStore.getState().navigation.pendingImportDestination;

      startTransition(() => {
        if (strategy === "append") {
          appendImportSummary(summary);
        } else {
          applyImportSummary(summary);
        }

        if (summary.items.length === 0) {
          return;
        }

        setCurrentScreen(destination);
        optionsRef.current?.onNavigateToDestination?.(destination);
      });
    },
    // [Patch #3] Removed unused setNotification from dependencies
    [applyImportSummary, appendImportSummary, setCurrentScreen],
  );

  // ---------------------------------------------------------------------------
  // importWithDialog – open native file picker
  // ---------------------------------------------------------------------------

  const importWithDialogFn = useCallback(
    async (mode: "files" | "folder", strategy: "replace" | "append" = "replace") => {
      if (!isTauriRuntime()) {
        setNotification({
          kind: "info",
          message: "浏览器预览环境不支持系统文件对话框，请在 Tauri 桌面环境中验证导入流程。",
        });
        return;
      }

      setIsImporting(true);
      setImporting(true);

      try {
        await waitForUiCommit();
        const selected = await open(
          mode === "folder"
            ? {
                title: "选择图片目录",
                directory: true,
                multiple: false,
                recursive: true,
              }
            : {
                title: "选择图片文件",
                multiple: true,
                filters: supportedFilters,
              },
        );

        if (!selected) {
          return;
        }

        const paths = Array.isArray(selected) ? selected : [selected];
        await waitForUiCommit();
        await importPathsFn(paths, strategy);
      } catch (error) {
        setNotification({ kind: "error", message: `导入失败：${String(error)}` });
      } finally {
        setIsImporting(false);
        setImporting(false);
      }
    },
    [importPathsFn, setImporting, setNotification],
  );

  // ---------------------------------------------------------------------------
  // startImportFlow – high-level entry point
  // [Patch #4] Defer side effects until dialog is confirmed
  // ---------------------------------------------------------------------------

  const startImportFlowFn = useCallback(
    async (mode: "files" | "folder", destination: "builder" | "preview", strategy: "replace" | "append" = "replace") => {
      // Set destination and optionally start new session AFTER dialog succeeds,
      // so cancellation does not leave stale state.
      setPendingImportDestination(destination);

      if (!isTauriRuntime()) {
        setNotification({
          kind: "info",
          message: "浏览器预览环境不支持系统文件对话框，请在 Tauri 桌面环境中验证导入流程。",
        });
        return;
      }

      setIsImporting(true);
      setImporting(true);

      try {
        await waitForUiCommit();
        const selected = await open(
          mode === "folder"
            ? { title: "选择图片目录", directory: true, multiple: false, recursive: true }
            : { title: "选择图片文件", multiple: true, filters: supportedFilters },
        );

        if (!selected) {
          return;
        }

        // [Patch #4] Only apply side effects when user actually selected files
        if (destination === "builder" && strategy === "replace") {
          startNewTemplateSession();
        }

        const paths = Array.isArray(selected) ? selected : [selected];
        await waitForUiCommit();
        await importPathsFn(paths, strategy);
      } catch (error) {
        setNotification({ kind: "error", message: `导入失败：${String(error)}` });
      } finally {
        setIsImporting(false);
        setImporting(false);
      }
    },
    [importPathsFn, setImporting, setNotification, setPendingImportDestination, startNewTemplateSession],
  );

  // ---------------------------------------------------------------------------
  // Drag & drop listener (Tauri native)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          if (dragSessionLockedRef.current || isImporting) {
            return;
          }
          setDragOverlayState("hover");
          return;
        }

        if (event.payload.type === "drop") {
          dragSessionLockedRef.current = true;
          setDragOverlayState("importing");
          setIsImporting(true);
          setImporting(true);
          try {
            await waitForUiCommit();
            await importPathsFn(event.payload.paths);
          } catch (error) {
            setNotification({ kind: "error", message: `拖拽导入失败：${String(error)}` });
          } finally {
            // [Patch #1] Also reset dragSessionLockedRef in finally
            dragSessionLockedRef.current = false;
            setIsImporting(false);
            setImporting(false);
            setDragOverlayState("idle");
          }
          return;
        }

        dragSessionLockedRef.current = false;
        setDragOverlayState("idle");
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        setNotification({
          kind: "info",
          message: "当前环境未启用窗口拖拽监听，请使用按钮导入。",
        });
      });

    return () => {
      unlisten?.();
    };
  }, [importPathsFn, isImporting, setImporting, setNotification]);

  return {
    isImporting,
    dragOverlayState,
    importWithDialog: importWithDialogFn,
    importPaths: importPathsFn,
    startImportFlow: startImportFlowFn,
  };
}
