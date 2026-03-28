import { useEffect, useRef, useState } from "react";

const STEP_SIZE = 0.05; // 每次按键移动的步长
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);

  const updatePositionFromClientX = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    const ratio = (clientX - bounds.left) / bounds.width;
    setPosition(Math.max(MIN_POSITION, Math.min(MAX_POSITION, ratio)));
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

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

  // 键盘控制
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
      case "Home":
        event.preventDefault();
        setPosition(MIN_POSITION);
        break;
      case "End":
        event.preventDefault();
        setPosition(MAX_POSITION);
        break;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    updatePositionFromClientX(event.clientX);
    setIsDragging(true);
  };

  return (
    <div
      ref={frameRef}
      className="relative h-[420px] overflow-hidden rounded-[24px] border border-line bg-white shadow-sm"
    >
      {beforeSrc ? (
        <img
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          src={beforeSrc}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">暂无原图</div>
      )}
      {afterSrc ? (
        <img
          alt={afterLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          src={afterSrc}
          style={{ clipPath: `inset(0 ${100 - position * 100}% 0 0)` }}
        />
      ) : null}

      <div className="absolute left-4 top-4 rounded-full bg-white/96 px-3 py-1 text-xs font-medium text-muted shadow-sm">
        {beforeLabel}
      </div>
      <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white shadow-sm">
        {afterLabel}
      </div>

      <div
        className="absolute inset-y-0 z-10 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: `${position * 100}%` }}
        onPointerDown={handlePointerDown}
      />
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position * 100}%` }}>
        <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-primary" />
      </div>
      <button
        ref={buttonRef}
        className="absolute top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-none"
        style={{ left: `${position * 100}%` }}
        type="button"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        aria-label="拖动滑杆，使用左右箭头键调整"
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
    </div>
  );
}
