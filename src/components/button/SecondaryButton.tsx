import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { LoadingButton } from "./LoadingButton";
import { cn } from "../../lib/utils";

export interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export const SecondaryButton = forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ loading, loadingText, size = "md", children, className, ...props }, ref) => {
    return (
      <LoadingButton
        ref={ref}
        variant="secondary"
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

SecondaryButton.displayName = "SecondaryButton";
