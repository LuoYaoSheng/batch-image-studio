import { memo } from "react";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const StartupScreen = memo(() => {
  // 组件显示 1.5 秒后由 App.tsx 控制隐藏
  // 实际的模型加载将在 App.tsx 中后台进行
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="应用正在初始化"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo / Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary to-primary-strong shadow-lg">
          <svg
            className="h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* App Name */}
        <div>
          <h1 className="text-2xl font-semibold text-ink">Batch Image Studio</h1>
          <p className="mt-2 text-sm text-muted">本地批量图片处理工具</p>
        </div>

        {/* Loading Spinner */}
        <LoadingSpinner />

        {/* Initial loading message */}
        <p className="text-sm text-muted">正在初始化...</p>
      </div>
    </div>
  );
});

StartupScreen.displayName = "StartupScreen";
