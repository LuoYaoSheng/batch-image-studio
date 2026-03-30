import type { AppScreen } from "../../types";

const NAV_ITEMS: Array<{ id: AppScreen; label: string; hint: string }> = [
  { id: "home", label: "1 导入图片", hint: "开始处理" },
  { id: "builder", label: "2 调整位置", hint: "框出要处理的地方" },
  { id: "preview", label: "3 确认效果", hint: "看样图是否正确" },
  { id: "batch", label: "4 开始处理", hint: "查看进度和结果" },
  { id: "templates", label: "常用做法", hint: "复用已保存模板" },
  { id: "history", label: "处理记录", hint: "找到上次结果" },
  { id: "settings", label: "默认设置", hint: "少量常用选项" },
];

export function SidebarNav({
  currentScreen,
  onNavigate,
}: {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-[#eef2f6] px-4 py-5">
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Batch Image Studio</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">图片批量处理大师</h1>
        <p className="mt-2 text-sm text-muted">模板驱动的桌面端图片局部批量处理工具。</p>
      </div>

      <div className="mt-6">
        <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-muted">主流程</p>
        <nav className="space-y-2">
          {NAV_ITEMS.slice(0, 4).map((item) => (
            <button
              key={item.id}
              className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                currentScreen === item.id
                  ? "bg-primary text-white shadow-ambient"
                  : "bg-white/70 text-ink hover:bg-white"
              }`}
              type="button"
              onClick={() => onNavigate(item.id)}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className={`mt-1 text-xs ${currentScreen === item.id ? "text-white/80" : "text-muted"}`}>
                {item.hint}
              </p>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-5">
        <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-muted">辅助功能</p>
        <nav className="space-y-2">
          {NAV_ITEMS.slice(4).map((item) => (
            <button
              key={item.id}
              className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                currentScreen === item.id
                  ? "bg-primary text-white shadow-ambient"
                  : "bg-white/70 text-ink hover:bg-white"
              }`}
              type="button"
              onClick={() => onNavigate(item.id)}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className={`mt-1 text-xs ${currentScreen === item.id ? "text-white/80" : "text-muted"}`}>
                {item.hint}
              </p>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-2xl bg-white px-4 py-4 shadow-sm">
        <p className="text-xs text-muted">快捷键</p>
        <div className="mt-3 space-y-1.5 text-xs text-muted">
          <p className="flex items-center justify-between gap-2">
            <span>首页</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">⌘1</kbd>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span>构建</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">⌘2</kbd>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span>预览</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">⌘3</kbd>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span>批量</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono">⌘4</kbd>
          </p>
        </div>
      </div>
    </aside>
  );
}
