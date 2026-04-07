import { useState } from "react";
import { cn } from "../../lib/utils";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "导入图片",
    description: "拖拽图片到应用或点击上传按钮，支持批量导入文件夹。",
    icon: `<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>`,
  },
  {
    id: 2,
    title: "框选区域",
    description: "在样图上框选需要处理的水印区域，支持拖拽调整。",
    icon: `<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>`,
  },
  {
    id: 3,
    title: "配置参数",
    description: "选择处理方式：智能修复、直接填充或裁剪。",
    icon: `<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>`,
  },
  {
    id: 4,
    title: "批量处理",
    description: "预览效果满意后，保存模板并批量处理所有图片。",
    icon: `<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>`,
  },
];

interface OnboardingGuideProps {
  onComplete?: () => void;
  className?: string;
}

export function OnboardingGuide({ onComplete, className }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-line shadow-ambient p-6 max-w-2xl mx-auto",
        className
      )}
    >
      {/* 进度指示器 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted">新手引导</span>
          <span className="text-xs px-2 py-0.5 bg-surface-low rounded-full text-muted">
            {currentStep + 1} / {ONBOARDING_STEPS.length}
          </span>
        </div>
        <button
          onClick={() => {
            setIsDismissed(true);
            onComplete?.();
          }}
          className="p-1.5 rounded-lg hover:bg-surface-low transition-colors"
          aria-label="关闭引导"
        >
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 步骤内容 */}
      <div className="flex items-start gap-6">
        <div className="shrink-0 w-16 h-16 rounded-2xl bg-surface-low flex items-center justify-center text-primary-strong">
          <div dangerouslySetInnerHTML={{ __html: step.icon }} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-ink mb-2">{step.title}</h3>
          <p className="text-muted mb-6">{step.description}</p>

          {/* 步骤导航 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {ONBOARDING_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "w-8 h-1.5 rounded-full transition-colors",
                    i === currentStep
                      ? "bg-primary-strong"
                      : i < currentStep
                      ? "bg-success"
                      : "bg-surface-rail"
                  )}
                  aria-label={`步骤 ${s.id}: ${s.title}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep((p) => p - 1)}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-ink transition-colors"
                >
                  上一步
                </button>
              )}
              {currentStep < ONBOARDING_STEPS.length - 1 ? (
                <button
                  onClick={() => setCurrentStep((p) => p + 1)}
                  className="px-4 py-2 text-sm font-medium bg-primary-strong hover:bg-primary text-white rounded-xl transition-colors"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsDismissed(true);
                    onComplete?.();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-success hover:bg-emerald-600 text-white rounded-xl transition-colors"
                >
                  开始使用
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
