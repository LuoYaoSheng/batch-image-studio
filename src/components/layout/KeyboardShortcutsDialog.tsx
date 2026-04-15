import type { ReactNode } from "react";

type ShortcutGroup = {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
};

const sidebarGroups: ShortcutGroup[] = [
  {
    title: "导航",
    shortcuts: [
      { keys: ["⌘", "1"], description: "首页" },
      { keys: ["⌘", "2"], description: "模板构建" },
      { keys: ["⌘", "3"], description: "效果预览" },
      { keys: ["⌘", "4"], description: "批量执行" },
      { keys: ["⌘", ","], description: "设置" },
    ],
  },
  {
    title: "操作",
    shortcuts: [
      { keys: ["⌘", "S"], description: "保存模板" },
      { keys: ["⌘", "O"], description: "导入图片" },
      { keys: ["⌘", "/"], description: "显示快捷键帮助" },
      { keys: ["Esc"], description: "关闭对话框" },
    ],
  },
  {
    title: "图片管理",
    shortcuts: [
      { keys: ["Delete"], description: "删除当前图片" },
      { keys: ["Backspace"], description: "删除当前图片" },
    ],
  },
  {
    title: "预览页",
    shortcuts: [
      { keys: ["←", "→"], description: "调整对比滑块" },
      { keys: ["Home", "End"], description: "跳到滑块两端" },
    ],
  },
  {
    title: "区域选择",
    shortcuts: [
      { keys: ["↑", "↓", "←", "→"], description: "移动选区" },
      { keys: ["Shift", "方向键"], description: "调整大小" },
    ],
  },
  {
    title: "样图列表",
    shortcuts: [
      { keys: ["↑", "↓"], description: "切换样图" },
      { keys: ["Delete", "Backspace"], description: "移除当前样图" },
    ],
  },
];

const workspaceGroups: ShortcutGroup[] = [
  {
    title: "步骤导航",
    shortcuts: [
      { keys: ["⌘", "1"], description: "回到首页" },
      { keys: ["⌘", "2"], description: "调整处理位置" },
      { keys: ["⌘", "3"], description: "效果预览" },
      { keys: ["⌘", "4"], description: "批量处理" },
    ],
  },
  {
    title: "操作",
    shortcuts: [
      { keys: ["⌘", "O"], description: "导入图片" },
      { keys: ["⌘", "T"], description: "常用做法" },
      { keys: ["⌘", "H"], description: "处理记录" },
      { keys: ["⌘", ","], description: "设置" },
      { keys: ["⌘", "/"], description: "显示快捷键帮助" },
      { keys: ["Esc"], description: "关闭对话框" },
    ],
  },
  {
    title: "预览页",
    shortcuts: [
      { keys: ["←", "→"], description: "调整对比滑块" },
      { keys: ["Home", "End"], description: "跳到滑块两端" },
    ],
  },
  {
    title: "区域选择",
    shortcuts: [
      { keys: ["↑", "↓", "←", "→"], description: "移动选区" },
      { keys: ["Shift", "方向键"], description: "调整大小" },
    ],
  },
  {
    title: "样图列表",
    shortcuts: [
      { keys: ["↑", "↓"], description: "切换样图" },
      { keys: ["Delete", "Backspace"], description: "移除当前样图" },
    ],
  },
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
  variant = "sidebar",
}: {
  isOpen: boolean;
  onClose: () => void;
  variant?: "sidebar" | "workspace";
}) {
  if (!isOpen) return null;

  const shortcutGroups = variant === "workspace" ? workspaceGroups : sidebarGroups;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 px-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[28px] border border-line bg-white p-6 shadow-ambient"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary-strong">Keyboard Shortcuts</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">快捷键</h3>
          </div>
          <button
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-white transition-colors"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-ink">{group.title}</p>
              <div className="mt-3 space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
                  >
                    <p className="text-sm text-muted">{shortcut.description}</p>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="rounded border border-line bg-white px-2 py-1 text-xs font-mono font-medium text-ink shadow-sm">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted">
            提示：使用 <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">⌘</kbd> 代替 <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">Ctrl</kbd> 在 macOS 上
          </p>
        </div>
      </div>
    </div>
  );
}
