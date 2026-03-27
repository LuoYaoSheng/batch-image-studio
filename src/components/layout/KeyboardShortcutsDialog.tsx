import type { ReactNode } from "react";

type ShortcutGroup = {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
};

const shortcutGroups: ShortcutGroup[] = [
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
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

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
