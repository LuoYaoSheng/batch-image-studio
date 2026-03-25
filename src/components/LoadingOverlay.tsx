import { memo } from "react";

type LoadingStage =
  | "importing"
  | "model-loading"
  | "reading"
  | "processing"
  | "generating"
  | "batch-processing";

interface LoadingOverlayProps {
  visible: boolean;
  stage: LoadingStage;
  progress?: number; // 0-100
  message?: string;
}

const stageConfig: Record<
  LoadingStage,
  { title: string; description: string; showProgress?: boolean }
> = {
  importing: {
    title: "导入图片中",
    description: "正在读取文件并生成缩略图...",
  },
  "model-loading": {
    title: "AI 模型加载中",
    description: "首次使用需要加载模型，请稍候...",
    showProgress: true,
  },
  reading: {
    title: "读取图片中",
    description: "正在加载原始图像...",
  },
  processing: {
    title: "AI 处理中",
    description: "正在使用 LaMa 模型修复水印区域...",
    showProgress: true,
  },
  generating: {
    title: "生成预览中",
    description: "正在渲染最终预览图像...",
  },
  "batch-processing": {
    title: "批量处理中",
    description: "正在处理多张图片，请稍候...",
    showProgress: true,
  },
};

const LoadingSpinner = memo(() => (
  <div className="relative h-16 w-16">
    <div className="absolute inset-0 animate-pulse rounded-full border-4 border-primary/20" />
    <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-transparent border-primary" />
  </div>
));

export const LoadingOverlay = memo(
  ({ visible, stage, progress, message }: LoadingOverlayProps) => {
    if (!visible) return null;

    const config = stageConfig[stage];
    const displayMessage = message ?? config.description;
    const displayProgress = progress ?? (stage === "model-loading" ? 0 : undefined);

    return (
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="rounded-[28px] border border-primary/30 bg-white px-10 py-8 text-center shadow-ambient">
          <div className="flex justify-center">
            <LoadingSpinner />
          </div>

          <p className="mt-5 text-lg font-semibold text-primary-strong">
            {config.title}
          </p>

          <p className="mt-2 text-sm text-muted">{displayMessage}</p>

          {config.showProgress && displayProgress !== undefined && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>进度</span>
                <span className="font-mono">{Math.round(displayProgress)}%</span>
              </div>
              <div className="h-2 w-64 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
                />
              </div>
            </div>
          )}

          {stage === "model-loading" && (
            <p className="mt-4 text-xs text-muted">
              提示：模型只需加载一次，后续处理会更快
            </p>
          )}
        </div>
      </div>
    );
  },
);

LoadingOverlay.displayName = "LoadingOverlay";
