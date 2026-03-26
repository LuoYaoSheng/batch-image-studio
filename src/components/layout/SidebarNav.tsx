import type { AppScreen } from "../../types";

const NAV_ITEMS: Array<{ id: AppScreen; label: string; hint: string }> = [
  { id: "home", label: "首页", hint: "导入与开始" },
  { id: "builder", label: "模板构建", hint: "框选与配置" },
  { id: "preview", label: "效果预览", hint: "确认效果" },
  { id: "batch", label: "批量执行", hint: "进度与结果" },
  { id: "templates", label: "模板中心", hint: "复用模板" },
  { id: "history", label: "历史记录", hint: "再次使用" },
  { id: "settings", label: "设置", hint: "默认项" },
];

export function SidebarNav({
  currentScreen,
  onNavigate,
}: {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-[#eef2f6] px-4 py-5">
      <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">Batch Image Studio</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">图片批量处理大师</h1>
        <p className="mt-2 text-sm text-muted">模板驱动的桌面端图片局部批量处理工具。</p>
      </div>

      <nav className="mt-6 space-y-2">
        {NAV_ITEMS.map((item) => (
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

      <div className="mt-auto rounded-2xl bg-white px-4 py-4 text-sm text-muted shadow-sm">
        当前重构阶段先使用 screen 状态驱动页面切换，后续再评估正式路由。
      </div>
    </aside>
  );
}
