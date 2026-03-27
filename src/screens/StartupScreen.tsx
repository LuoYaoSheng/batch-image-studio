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
        <div className="h-20 w-20 overflow-hidden rounded-[28px] shadow-lg">
          <img src="/icon-rounded-256.png" alt="Batch Image Studio" className="h-full w-full object-cover" />
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
