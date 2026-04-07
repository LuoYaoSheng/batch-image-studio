import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { LoadingButton } from "./LoadingButton";
import { cn } from "../../lib/utils";

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ loading, loadingText, size = "md", children, className, ...props }, ref) => {
    return (
      <LoadingButton
        ref={ref}
        variant="primary"
        size={size}
        loading={loading}
        loadingText={loadingText}
        className={cn("", className)}
        {...props}
      >
        {children}
      </LoadingButton>
    );
  }
);

PrimaryButton.displayName = "PrimaryButton";
