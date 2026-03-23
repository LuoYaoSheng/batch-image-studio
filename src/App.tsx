import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "./store/workspace";

type BootstrapState = {
  appName: string;
  appVersion: string;
  platform: string;
  capabilities: string[];
};

const navItems = ["工作台", "样张预览", "批量执行", "模板中心", "历史记录", "设置"];

const milestones = [
  {
    title: "导入与分组",
    detail: "支持拖拽图片与文件夹导入，按尺寸和格式整理任务池。",
  },
  {
    title: "识别框编辑",
    detail: "优先交付固定位置模式，再扩展自动识别与混合模式。",
  },
  {
    title: "清理预览",
    detail: "先落地模糊覆盖、纯色覆盖、裁切，智能修复后接。",
  },
];

const stats = [
  { label: "当前任务图片", value: "128" },
  { label: "候选识别区域", value: "412" },
  { label: "预估处理成功率", value: "96%" },
];

export default function App() {
  const { selectedMode, setMode, importedCount, previewStatus } = useWorkspaceStore();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);

  useEffect(() => {
    invoke<BootstrapState>("bootstrap_state")
      .then(setBootstrapState)
      .catch(() => {
        setBootstrapState(null);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,95,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)] text-ink">
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)_340px] gap-4 p-4">
        <aside className="rounded-panel border border-white/70 bg-surface-rail/75 p-5 shadow-ambient backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-primary text-lg font-semibold text-white">
              BI
            </div>
            <div>
              <p className="text-base font-semibold">Batch Image Studio</p>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Desktop MVP</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                  index === 0
                    ? "bg-surface-panel text-primary shadow-sm"
                    : "text-muted hover:bg-white/55 hover:text-ink"
                }`}
                type="button"
              >
                <span>{item}</span>
                <span className="font-mono text-xs">{String(index).padStart(2, "0")}</span>
              </button>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl bg-primary p-4 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/70">本轮优先级</p>
            <p className="mt-2 text-lg font-semibold">先做固定区域批处理闭环</p>
            <p className="mt-2 text-sm text-white/80">
              避免第一版过早绑定 OCR 或复杂修复算法。
            </p>
          </div>
        </aside>

        <main className="rounded-panel border border-white/70 bg-surface-panel/85 p-6 shadow-ambient backdrop-blur">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-primary-strong">工程起步</p>
              <h1 className="mt-2 text-3xl font-semibold">桌面端 MVP 骨架已就位</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                当前仓库已经从 PRD 和静态原型升级为可运行的 Tauri + React 工程。下一阶段开始接入导入、
                识别框编辑和局部清理的真实业务流。
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">预览状态</p>
              <p className="mt-2 text-lg font-semibold">
                {previewStatus === "ready" ? "Ready" : "Idle"}
              </p>
            </div>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-line bg-surface px-5 py-4"
              >
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
            <article className="rounded-[24px] border border-line bg-[linear-gradient(180deg,_rgba(0,95,184,0.08),_rgba(255,255,255,0.92))] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary-strong">实施路径</p>
                  <h2 className="mt-1 text-xl font-semibold">先交付最短业务闭环</h2>
                </div>
                <p className="rounded-full bg-white px-3 py-1 font-mono text-xs text-muted">
                  {importedCount} files
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {milestones.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/80 bg-white/80 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-line bg-surface p-5">
              <p className="text-sm font-medium text-primary-strong">检测模式</p>
              <div className="mt-4 grid gap-2">
                {[
                  { id: "fixed", label: "固定位置模式" },
                  { id: "auto", label: "自动识别模式" },
                  { id: "hybrid", label: "混合模式" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selectedMode === item.id
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-white hover:border-primary-strong"
                    }`}
                    type="button"
                    onClick={() => setMode(item.id as "fixed" | "auto" | "hybrid")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface-low p-4">
                <p className="text-sm font-medium">Native Bridge</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  前端已经连通 Tauri 命令层，后续文件扫描、预览生成、批处理都从这里接入。
                </p>
                {bootstrapState ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      <span className="text-muted">App:</span> {bootstrapState.appName}{" "}
                      {bootstrapState.appVersion}
                    </p>
                    <p>
                      <span className="text-muted">Platform:</span> {bootstrapState.platform}
                    </p>
                    <p>
                      <span className="text-muted">Capabilities:</span>{" "}
                      {bootstrapState.capabilities.join(", ")}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-warning">
                    当前在浏览器模式下运行，原生命令信息不可用。
                  </p>
                )}
              </div>
            </article>
          </section>
        </main>

        <aside className="rounded-panel border border-white/70 bg-[#f1f4f8]/88 p-5 shadow-ambient backdrop-blur">
          <p className="text-sm uppercase tracking-[0.28em] text-primary-strong">Next Actions</p>
          <div className="mt-5 space-y-4">
            {[
              "建立导入文件与任务数据模型",
              "补图片列表与画布预览组件",
              "接固定区域框选和参数保存",
              "接首版模糊覆盖与导出目录",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-sm leading-6">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-ink px-4 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/50">Repo Hygiene</p>
            <p className="mt-2 text-sm leading-6 text-white/80">
              `stitch/` 已作为本地参考原型保留，但不会进入版本控制。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
