import { useEffect, useRef, useState } from "react";

const STEP_SIZE = 0.05;
const MIN_POSITION = 0.05;
const MAX_POSITION = 0.95;

/**
 * 带兜底的图片组件：优先加载高清 src，失败后回退到 fallback（缩略图 data URL）
 */
function FallbackImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string | undefined;
  fallback?: string | null;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const effectiveSrc = errored && fallback ? fallback : src;

  return (
    <img
      alt={alt}
      className={className}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      src={effectiveSrc}
      onError={() => {
        if (!errored && fallback) {
          setErrored(true);
        }
      }}
    />
  );
}

export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeFallback,
  beforeLabel = "原图",
  afterLabel = "处理后",
  isLoading = false,
  loadingMessage,
}: {
  beforeSrc: string | null;
  afterSrc: string | null;
  beforeFallback?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  isLoading?: boolean;
  loadingMessage?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const canUseSlider = Boolean(beforeSrc) && Boolean(afterSrc);

  const updatePositionFromClientX = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const ratio = (clientX - bounds.left) / bounds.width;
    setPosition(Math.max(MIN_POSITION, Math.min(MAX_POSITION, ratio)));
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (event: PointerEvent) => updatePositionFromClientX(event.clientX);
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

  // ── 加载中状态 ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-primary/20 bg-white p-6 shadow-sm">
        <div className="flex h-[480px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary/20 border-t-primary" />
            <div className="text-center">
              <p className="text-base font-medium text-primary-strong">正在生成预览...</p>
              {loadingMessage ? (
                <p className="mt-2 text-sm text-muted">{loadingMessage}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">模型正在处理图片，通常需要几秒钟</p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── 无图状态 ────────────────────────────────────────────────────────
  if (!beforeSrc && !afterSrc) {
    return (
      <section className="rounded-[28px] border border-dashed border-line bg-surface p-6 shadow-sm">
        <div className="flex h-[480px] items-center justify-center text-sm text-muted">
          暂无预览内容
        </div>
      </section>
    );
  }

  // ── 只有处理结果（无原图）── 直接展示 ────────────────────────────────
  if (!canUseSlider && afterSrc) {
    return (
      <section className="rounded-[28px] border border-primary/20 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
            {afterLabel}
          </div>
          <p className="text-xs text-muted">处理结果预览</p>
        </div>
        <div className="flex items-center justify-center bg-surface">
          <img
            alt={afterLabel}
            className="max-h-[520px] w-full select-none object-contain"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            src={afterSrc}
          />
        </div>
      </section>
    );
  }

  // ── 只有原图（未处理）── 直接展示 ──────────────────────────────────
  if (!canUseSlider && beforeSrc) {
    return (
      <section className="rounded-[28px] border border-line bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
            {beforeLabel}
          </div>
          <p className="text-xs text-muted">原始图片</p>
        </div>
        <div className="flex items-center justify-center bg-surface">
          <FallbackImage
            src={beforeSrc}
            fallback={beforeFallback}
            alt={beforeLabel}
            className="max-h-[520px] w-full select-none object-contain"
          />
        </div>
      </section>
    );
  }

  // ── 滑杆对比视图（主视图）──────────────────────────────────────────
  return (
    <section className="rounded-[28px] border border-line bg-white shadow-sm overflow-hidden">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
            {beforeLabel}
          </div>
          <span className="text-xs text-muted">←</span>
          <p className="text-xs text-muted">拖动分界线对比</p>
          <span className="text-xs text-muted">→</span>
          <div className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
            {afterLabel}
          </div>
        </div>
        <p className="text-xs text-muted">← → 键微调 · Home/End 跳两端</p>
      </div>
      {/* 滑杆画布 */}
      <div
        ref={frameRef}
        className="relative h-[520px] overflow-hidden bg-surface cursor-ew-resize"
        onPointerDown={handlePointerDown}
      >
        {/* 底层：原图（高清优先，失败回退缩略图） */}
        <FallbackImage
          src={beforeSrc!}
          fallback={beforeFallback}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
        {/* 上层：处理后（裁切） */}
        <img
          alt={afterLabel}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          src={afterSrc!}
          style={{ clipPath: `inset(0 ${100 - position * 100}% 0 0)` }}
        />

        {/* 标签 */}
        <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {beforeLabel}
        </div>
        <div className="absolute right-4 top-4 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {afterLabel}
        </div>

        {/* 分割线 */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position * 100}%` }}>
          <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.3)]" />
        </div>

        {/* 拖动手柄 */}
        <button
          ref={buttonRef}
          className="absolute top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-none"
          style={{ left: `${position * 100}%` }}
          type="button"
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          aria-label="拖动滑杆，使用左右箭头键调整"
          aria-valuenow={Math.round(position * 100)}
          aria-valuemin={5}
          aria-valuemax={95}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
          <svg className="h-4 w-4 -rotate-180" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    </section>
  );
}
