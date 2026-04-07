import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef, useState } from "react";
import { cn } from "../../lib/utils";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const buttonVariants = {
  primary: "bg-primary-strong hover:bg-primary active:bg-primary text-white shadow-sm",
  secondary: "bg-white hover:bg-surface-low border border-line text-ink",
  ghost: "hover:bg-surface-low text-muted hover:text-ink",
  danger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm",
};

const sizeVariants = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-12 px-6 text-lg",
};

const spinnerSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      loading = false,
      loadingText,
      variant = "primary",
      size = "md",
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [showLoading, setShowLoading] = useState(false);

    // 延迟显示 loading 状态，避免闪烁
    if (loading && !showLoading) {
      setTimeout(() => setShowLoading(true), 150);
    } else if (!loading && showLoading) {
      setShowLoading(false);
    }

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2",
          buttonVariants[variant],
          sizeVariants[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className={cn("animate-spin", spinnerSizes[size])}
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={loading && loadingText ? "" : ""}>
          {loading && loadingText ? loadingText : children}
        </span>
      </button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";
