import { useEffect, useRef, useState } from "react";

const STEP_SIZE = 0.05;
const MIN_POSITION = 0.05;
const MAX_POSITION = 0.95;

export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "原图",
  afterLabel = "处理后",
}: {
  beforeSrc: string | null;
  afterSrc: string | null;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const hasBefore = Boolean(beforeSrc);
  const hasAfter = Boolean(afterSrc);

  const updatePositionFromClientX = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;

    const bounds = frame.getBoundingClientRect();
    const ratio = (clientX - bounds.left) / bounds.width;
    setPosition(Math.max(MIN_POSITION, Math.min(MAX_POSITION, ratio)));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent) => {
      updatePositionFromClientX(event.clientX);
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        setPosition((p) => Math.max(MIN_POSITION, p - STEP_SIZE));
        break;
      case "ArrowRight":
        event.preventDefault();
        setPosition((p) => Math.min(MAX_POSITION, p + STEP_SIZE));
        break;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    updatePositionFromClientX(event.clientX);
    setIsDragging(true);
  };

  // 固定高度的容器，不会因内容变化而变化
  const containerClass = "h-[560px] w-full rounded-[24px] border border-line bg-white";

  // 无内容时的占位状态
  if (!hasBefore && !hasAfter) {
    return (
      <div className={`${containerClass} border-dashed bg-surface flex items-center justify-center`}>
        <p className="text-sm text-muted">生成预览后会显示对比效果</p>
      </div>
    );
  }

  // 只有原图的情况
  if (hasBefore && !hasAfter) {
    return (
      <div className={containerClass}>
        <div className="relative h-full w-full overflow-hidden rounded-inherit bg-surface">
          <img
            alt={beforeLabel}
            className="h-full w-full select-none object-contain"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            src={beforeSrc ?? undefined}
          />
          <div className="absolute left-4 top-4 rounded-full bg-white/96 px-3 py-1 text-xs font-medium text-muted shadow-sm">
            {beforeLabel}
          </div>
        </div>
      </div>
    );
  }

  // 对比滑杆（核心功能）
  return (
    <div className={containerClass}>
      <div
        ref={frameRef}
        className="relative h-full w-full overflow-hidden rounded-inherit"
      >
        {/* 底层：原图 */}
        <img
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          src={beforeSrc ?? undefined}
        />

        {/* 顶层：处理后（用 clipPath 裁剪） */}
        <img
          alt={afterLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          src={afterSrc ?? undefined}
          style={{ clipPath: `inset(0 ${100 - position * 100}% 0 0)` }}
        />

        {/* 标签：原图 */}
        <div className="absolute left-4 top-4 rounded-full bg-white/96 px-3 py-1 text-xs font-medium text-muted shadow-sm">
          {beforeLabel}
        </div>

        {/* 标签：处理后 */}
        <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white shadow-sm">
          {afterLabel}
        </div>

        {/* 拖动区域 */}
        <div
          className="absolute inset-y-0 z-10 w-12 -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: `${position * 100}%` }}
          onPointerDown={handlePointerDown}
        />

        {/* 分界线 */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-lg"
          style={{ left: `${position * 100}%` }}
        />

        {/* 拖动手柄 */}
        <button
          className="absolute top-1/2 z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-none"
          style={{ left: `${position * 100}%` }}
          type="button"
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          aria-label="拖动滑杆对比，使用左右箭头键调整"
          aria-valuenow={Math.round(position * 100)}
          aria-valuemin={5}
          aria-valuemax={95}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
          <svg className="h-5 w-5 -rotate-180" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
        </button>

        {/* 底部提示 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white backdrop-blur-sm">
          拖动滑杆对比效果 · 键盘 ←→ 可微调
        </div>
      </div>
    </div>
  );
}
