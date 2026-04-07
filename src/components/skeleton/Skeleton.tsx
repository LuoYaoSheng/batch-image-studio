import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-surface-low via-surface-rail to-surface-low",
        "animate-[shimmer_2s_infinite_linear]",
        "[background-size:1000px_100%]",
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonCircle({ size = 40, className, style }: SkeletonCircleProps) {
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-r from-surface-low via-surface-rail to-surface-low",
        "animate-[shimmer_2s_infinite_linear]",
        "[background-size:1000px_100%]",
        className
      )}
      style={{ width: size, height: size, ...style }}
      role="presentation"
      aria-hidden="true"
    />
  );
}
