import { memo } from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-16 w-16 border-4",
} as const;

export const LoadingSpinner = memo(({ size = "md" }: LoadingSpinnerProps) => (
  <div className={`relative ${sizeClasses[size].split(" ")[0]} ${sizeClasses[size].split(" ")[1]}`}>
    <div className={`absolute inset-0 animate-pulse rounded-full ${sizeClasses[size].split(" ")[2]} border-primary/20`} />
    <div className={`absolute inset-0 animate-spin rounded-full ${sizeClasses[size].split(" ")[2]} border-t-transparent border-primary`} />
  </div>
));

LoadingSpinner.displayName = "LoadingSpinner";
