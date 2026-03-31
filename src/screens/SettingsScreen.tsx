import type { AppSettings, CleanupMethod, FileNamingRule, OutputFormat, SizeHandlingMode } from "../types";
import { applyFileNamingRule } from "../types";
import { getCompatibleModelPackageSources, getOfficialModelInfoSource } from "../lib/modelPackageSources";

// 示例文件名用于预览
const EXAMPLE_FILES = ["IMG_20260327_001.jpg", "screenshot.png", "photo-2026.webp"];

export function SettingsScreen({
  appSettings,
  isModelAvailable,
  modelInstallDir,
  preferredModelSource,
  onUpdateSettings,
  onChooseDefaultOutputDir,
  onOpenModelDir,
  onDownloadModel,
  onImportModelPackage,
  onOpenOfficialModelInfo,
}: {
  appSettings: AppSettings;
  isModelAvailable: boolean;
  modelInstallDir: string;
  preferredModelSource: "local" | "bundled" | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onChooseDefaultOutputDir: () => void;
  onOpenModelDir: () => void;
  onDownloadModel: (sourceId?: "compatible-github") => void;
  onImportModelPackage: () => void;
  onOpenOfficialModelInfo: () => void;
}) {
  const modelPackageSources = getCompatibleModelPackageSources();
  const officialModelInfoSource = getOfficialModelInfoSource();
  // 生成预览文件名列表
  const previewFilenames = EXAMPLE_FILES.map((file) =>
    applyFileNamingRule(
      file,
      appSettings.defaultFileNamingRule,
      appSettings.customFileNamingPattern,
      1,
      appSettings.defaultFormat,
    )
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-primary-strong">Settings</p>
        <h3 className="mt-2 text-2xl font-semibold text-ink">应用默认设置</h3>
        <p className="mt-2 text-sm text-muted">这里保存的是默认项，主流程仍然在首页、构建页、预览页和批量页完成。</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-ink">基础设置</h4>
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">默认处理方式</span>
              <select
                className="h-11 w-full rounded-xl border border-line bg-surface px-3"
                value={appSettings.defaultCleanupMethod}
                onChange={(event) =>
                  onUpdateSettings({ defaultCleanupMethod: event.target.value as CleanupMethod })
                }
              >
                <option value="blur">AI修复</option>
                <option value="fill">纯色填充</option>
                <option value="crop">裁切</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">默认定位方式</span>
              <select
                className="h-11 w-full rounded-xl border border-line bg-surface px-3"
                value={appSettings.defaultSizeHandlingMode}
                onChange={(event) =>
                  onUpdateSettings({
                    defaultSizeHandlingMode: event.target.value as SizeHandlingMode,
                  })
                }
              >
                <option value="bottomRight">右下角锚定</option>
                <option value="relative">按比例定位</option>
                <option value="absolute">固定像素</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-ink">输出设置</h4>
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">默认输出格式</span>
              <select
                className="h-11 w-full rounded-xl border border-line bg-surface px-3"
                value={appSettings.defaultFormat}
                onChange={(event) =>
                  onUpdateSettings({ defaultFormat: event.target.value as OutputFormat })
                }
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WEBP</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">文件命名规则</span>
              <select
                className="h-11 w-full rounded-xl border border-line bg-surface px-3"
                value={appSettings.defaultFileNamingRule}
                onChange={(event) =>
                  onUpdateSettings({ defaultFileNamingRule: event.target.value as FileNamingRule })
                }
              >
                <option value="name_processed">原名_已处理</option>
                <option value="name_cleaned">原名_去除水印</option>
                <option value="name_timestamp">原名_[时间戳]</option>
                <option value="custom">自定义规则</option>
              </select>
            </label>

            {appSettings.defaultFileNamingRule === "custom" && (
              <div className="rounded-xl border border-line bg-surface p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">自定义模式</span>
                  <span className="mb-1 block text-xs text-muted">
                    可用变量: {"{name}"}、{"{timestamp}"}、{"{index}"}
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3"
                    placeholder="{name}_{timestamp}"
                    value={appSettings.customFileNamingPattern || ""}
                    onChange={(event) =>
                      onUpdateSettings({ customFileNamingPattern: event.target.value })
                    }
                  />
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted">预览效果:</div>
                    {previewFilenames.map((filename, i) => (
                      <div key={i} className="text-xs font-mono text-ink bg-surface px-2 py-1 rounded">
                        {filename}
                      </div>
                    ))}
                  </div>
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">默认输出目录</span>
              <div className="flex gap-2">
                <input
                  className="h-11 flex-1 rounded-xl border border-line bg-surface px-3"
                  value={appSettings.defaultOutputDir}
                  onChange={(event) => onUpdateSettings({ defaultOutputDir: event.target.value })}
                />
                <button
                  className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
                  type="button"
                  onClick={onChooseDefaultOutputDir}
                >
                  选择
                </button>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <h4 className="text-lg font-semibold text-ink">模型管理</h4>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
              <p className="text-xs text-muted">当前状态</p>
              <p className="mt-2 text-sm font-medium text-ink">
                {isModelAvailable ? "已检测到智能修复模型" : "尚未安装智能修复模型"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {preferredModelSource === "local"
                  ? "当前优先使用本地安装模型"
                  : preferredModelSource === "bundled"
                    ? "当前使用应用内置模型"
                    : "安装后才能使用预览和批量智能修复"}
              </p>
            </div>
            <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
              <p className="text-xs text-muted">模型目录</p>
              <p className="mt-2 break-all text-sm font-medium text-ink">{modelInstallDir || "尚未初始化"}</p>
              <p className="mt-1 text-xs text-muted">
                你可以直接下载安装本应用兼容模型包，或者先看官方项目说明，再手动导入模型包。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white"
              type="button"
              onClick={() => onDownloadModel()}
            >
              下载并安装
            </button>
            <button
              className="rounded-2xl border border-primary bg-white px-5 py-3 text-sm font-medium text-primary"
              type="button"
              onClick={onImportModelPackage}
            >
              导入模型包
            </button>
            <button
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium"
              type="button"
              onClick={onOpenModelDir}
            >
              打开模型目录
            </button>
            <button
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium"
              type="button"
              onClick={onOpenOfficialModelInfo}
            >
              查看官方项目
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {modelPackageSources.map((source) => (
            <button
              key={source.id}
              className="rounded-[20px] border border-line bg-surface px-4 py-4 text-left"
              type="button"
              onClick={() => onDownloadModel(source.id)}
            >
              <p className="text-sm font-medium text-ink">{source.label}</p>
              <p className="mt-1 text-xs text-muted">{source.description}</p>
            </button>
          ))}
          <button
            className="rounded-[20px] border border-line bg-surface px-4 py-4 text-left"
            type="button"
            onClick={onOpenOfficialModelInfo}
          >
            <p className="text-sm font-medium text-ink">{officialModelInfoSource.label}</p>
            <p className="mt-1 text-xs text-muted">{officialModelInfoSource.description}</p>
          </button>
        </div>
      </section>
    </div>
  );
}
