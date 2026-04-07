import { useEffect, useRef, useState } from "react";
import type { Region } from "../../types";
import { clampRegion, getContainedRect } from "../../lib/region";

type ResizeMode =
  | "move"
  | "resize-n"
  | "resize-s"
  | "resize-e"
  | "resize-w"
  | "resize-ne"
  | "resize-nw"
  | "resize-se"
  | "resize-sw";

const HANDLE_SIZE = 12;
const CORNER_HANDLE_SIZE = 16;
const EDGE_HIT_SIZE = 8;
const KEYBOARD_MOVE_STEP = 0.01; // 键盘移动步长
const KEYBOARD_RESIZE_STEP = 0.01; // 键盘调整大小步长

export function PreviewCanvasCard({
  title,
  image,
  region,
  selected,
  dimensions,
  frameHeight,
  editable = false,
  onRegionChange,
  loading = false,
  loadingMessage,
}: {
  title: string;
  image: string | null;
  region?: Region;
  selected?: boolean;
  dimensions?: { width: number; height: number };
  frameHeight?: number;
  editable?: boolean;
  onRegionChange?: (patch: Partial<Region>) => void;
  loading?: boolean;
  loadingMessage?: string;
}) {
  const canvasHeight = frameHeight ?? (editable ? 380 : 320);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const regionChangeFrameRef = useRef<number | null>(null);
  const pendingRegionChangeRef = useRef<Partial<Region> | Region | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: canvasHeight });
  const [hoveredHandle, setHoveredHandle] = useState<ResizeMode | null>(null);
  const contained = getContainedRect(frameSize, dimensions);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateSize = () => {
      const bounds = frame.getBoundingClientRect();
      setFrameSize({ width: bounds.width, height: bounds.height });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (regionChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(regionChangeFrameRef.current);
      }
    };
  }, []);

  function flushQueuedRegionChange() {
    if (!onRegionChange || !pendingRegionChangeRef.current) {
      return;
    }

    const next = pendingRegionChangeRef.current;
    pendingRegionChangeRef.current = null;
    onRegionChange(next);
  }

  function queueRegionChange(next: Partial<Region> | Region) {
    if (!onRegionChange) {
      return;
    }

    pendingRegionChangeRef.current = next;
    if (regionChangeFrameRef.current !== null) {
      return;
    }

    regionChangeFrameRef.current = window.requestAnimationFrame(() => {
      regionChangeFrameRef.current = null;
      flushQueuedRegionChange();
    });
  }

  function getCursorForHandle(mode: ResizeMode | null): string {
    const cursorMap: Record<ResizeMode, string> = {
      move: "move",
      "resize-n": "ns-resize",
      "resize-s": "ns-resize",
      "resize-e": "ew-resize",
      "resize-w": "ew-resize",
      "resize-ne": "nesw-resize",
      "resize-nw": "nwse-resize",
      "resize-se": "nwse-resize",
      "resize-sw": "nesw-resize",
    };
    return mode ? cursorMap[mode] : "crosshair";
  }

  function locatePointer(clientX: number, clientY: number) {
    const frame = frameRef.current;
    if (!frame) {
      return null;
    }

    const bounds = frame.getBoundingClientRect();
    const relativeX = clientX - bounds.left;
    const relativeY = clientY - bounds.top;

    if (
      relativeX < contained.left ||
      relativeX > contained.left + contained.width ||
      relativeY < contained.top ||
      relativeY > contained.top + contained.height
    ) {
      return null;
    }

    const x = (relativeX - contained.left) / contained.width;
    const y = (relativeY - contained.top) / contained.height;

    const baseRegion = region ?? {
      x: 0.39,
      y: 0.39,
      width: 0.22,
      height: 0.12,
    };

    return clampRegion({
      x: x - baseRegion.width / 2,
      y: y - baseRegion.height / 2,
      width: baseRegion.width,
      height: baseRegion.height,
    });
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable || !onRegionChange) {
      return;
    }

    const next = locatePointer(event.clientX, event.clientY);
    if (!next) {
      return;
    }

    onRegionChange(next);
  }

  function getResizeModeAtPosition(clientX: number, clientY: number): ResizeMode | null {
    if (!region || !frameRef.current) {
      return null;
    }

    const bounds = frameRef.current.getBoundingClientRect();
    const relativeX = clientX - bounds.left - contained.left;
    const relativeY = clientY - bounds.top - contained.top;

    const regionLeft = region.x * contained.width;
    const regionTop = region.y * contained.height;
    const regionRight = regionLeft + region.width * contained.width;
    const regionBottom = regionTop + region.height * contained.height;

    const isNear = (value: number, target: number) => Math.abs(value - target) < EDGE_HIT_SIZE;

    // 检查四个角
    if (isNear(relativeX, regionLeft) && isNear(relativeY, regionTop)) {
      return "resize-nw";
    }
    if (isNear(relativeX, regionRight) && isNear(relativeY, regionTop)) {
      return "resize-ne";
    }
    if (isNear(relativeX, regionLeft) && isNear(relativeY, regionBottom)) {
      return "resize-sw";
    }
    if (isNear(relativeX, regionRight) && isNear(relativeY, regionBottom)) {
      return "resize-se";
    }

    // 检查四条边
    if (isNear(relativeX, regionLeft) && relativeY > regionTop && relativeY < regionBottom) {
      return "resize-w";
    }
    if (isNear(relativeX, regionRight) && relativeY > regionTop && relativeY < regionBottom) {
      return "resize-e";
    }
    if (isNear(relativeY, regionTop) && relativeX > regionLeft && relativeX < regionRight) {
      return "resize-n";
    }
    if (isNear(relativeY, regionBottom) && relativeX > regionLeft && relativeX < regionRight) {
      return "resize-s";
    }

    // 检查是否在区域内
    if (
      relativeX > regionLeft &&
      relativeX < regionRight &&
      relativeY > regionTop &&
      relativeY < regionBottom
    ) {
      return "move";
    }

    return null;
  }

  function handleRegionPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable) {
      return;
    }

    const mode = getResizeModeAtPosition(event.clientX, event.clientY);
    setHoveredHandle(mode);
  }

  function handleRegionPointerLeave() {
    setHoveredHandle(null);
  }

  function startRegionInteraction(event: React.PointerEvent<HTMLDivElement>, mode: ResizeMode) {
    if (!editable || !region || !onRegionChange || !frameRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initialRegion = region;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / contained.width;
      const dy = (moveEvent.clientY - startY) / contained.height;

      if (mode === "move") {
        queueRegionChange(
          clampRegion({
            x: initialRegion.x + dx,
            y: initialRegion.y + dy,
            width: initialRegion.width,
            height: initialRegion.height,
          }),
        );
        return;
      }

      // 计算新的区域边界
      let newX = initialRegion.x;
      let newY = initialRegion.y;
      let newWidth = initialRegion.width;
      let newHeight = initialRegion.height;

      // 向上调整 (n, ne, nw)
      if (mode === "resize-n" || mode === "resize-ne" || mode === "resize-nw") {
        const deltaY = Math.min(dy, initialRegion.y); // 不能超出上边界
        newY = initialRegion.y + deltaY;
        newHeight = initialRegion.height - deltaY;
      }

      // 向下调整 (s, se, sw)
      if (mode === "resize-s" || mode === "resize-se" || mode === "resize-sw") {
        newHeight = Math.max(0.02, Math.min(1 - initialRegion.y, initialRegion.height + dy));
      }

      // 向左调整 (w, nw, sw)
      if (mode === "resize-w" || mode === "resize-nw" || mode === "resize-sw") {
        const deltaX = Math.min(dx, initialRegion.x); // 不能超出左边界
        newX = initialRegion.x + deltaX;
        newWidth = initialRegion.width - deltaX;
      }

      // 向右调整 (e, ne, se)
      if (mode === "resize-e" || mode === "resize-ne" || mode === "resize-se") {
        newWidth = Math.max(0.02, Math.min(1 - initialRegion.x, initialRegion.width + dx));
      }

      queueRegionChange(
        clampRegion({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        }),
      );
    };

    const onUp = () => {
      if (regionChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(regionChangeFrameRef.current);
        regionChangeFrameRef.current = null;
      }
      flushQueuedRegionChange();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 键盘微调支持
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editable || !region || !onRegionChange) {
      return;
    }

    // 只处理方向键
    if (
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) &&
      !(event.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key))
    ) {
      return;
    }

    event.preventDefault();

    const isShift = event.shiftKey;
    const step = isShift ? KEYBOARD_RESIZE_STEP : KEYBOARD_MOVE_STEP;

    if (!isShift) {
      // 移动模式
      let newX = region.x;
      let newY = region.y;

      switch (event.key) {
        case "ArrowUp":
          newY = Math.max(0, region.y - step);
          break;
        case "ArrowDown":
          newY = Math.min(1 - region.height, region.y + step);
          break;
        case "ArrowLeft":
          newX = Math.max(0, region.x - step);
          break;
        case "ArrowRight":
          newX = Math.min(1 - region.width, region.x + step);
          break;
      }

      onRegionChange({ x: newX, y: newY });
    } else {
      // 调整大小模式
      let newWidth = region.width;
      let newHeight = region.height;

      switch (event.key) {
        case "ArrowUp":
          newHeight = Math.max(0.02, region.height - step);
          break;
        case "ArrowDown":
          newHeight = Math.min(1 - region.y, region.height + step);
          break;
        case "ArrowLeft":
          newWidth = Math.max(0.02, region.width - step);
          break;
        case "ArrowRight":
          newWidth = Math.min(1 - region.x, region.width + step);
          break;
      }

      onRegionChange({ width: newWidth, height: newHeight });
    }
  };

  return (
    <section className="rounded-[24px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-strong">
          {title}
        </h3>
        {dimensions ? (
          <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-muted">
            {dimensions.width} × {dimensions.height}
          </span>
        ) : null}
      </div>

      <div
        ref={frameRef}
        className={`relative mt-4 overflow-hidden rounded-[20px] border border-line bg-white ${
          editable ? "cursor-crosshair" : ""
        }`}
        style={{ cursor: hoveredHandle ? getCursorForHandle(hoveredHandle) : undefined }}
        onPointerDown={handleCanvasPointerDown}
      >
        {image ? (
          <>
            <img
              alt={title}
              className={`h-[320px] w-full object-contain transition duration-300 ${
                loading ? "scale-[0.985] opacity-45" : editable && !region ? "opacity-60" : "opacity-100"
              }`}
              style={{ height: `${canvasHeight}px` }}
              src={image}
            />
            {/* 空状态引导 - 有图片但没选区时显示 */}
            {editable && !region && !loading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/95 px-6 py-5 shadow-lg">
                  <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="text-sm font-semibold text-ink">点击图片创建选区</p>
                  <p className="text-xs text-muted">在图片上点击，标记需要处理的位置</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted" style={{ height: `${canvasHeight}px` }}>
            <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>暂无图像</p>
            <p className="text-xs">请先导入图片</p>
          </div>
        )}
        {image && region && selected ? (
          <div
            className={`absolute select-none ${
              editable ? "cursor-move focus:outline-none" : "pointer-events-none"
            }`}
            tabIndex={editable ? 0 : undefined}
            style={{
              left: `${contained.left + region.x * contained.width}px`,
              top: `${contained.top + region.y * contained.height}px`,
              width: `${region.width * contained.width}px`,
              height: `${region.height * contained.height}px`,
            }}
            onPointerMove={handleRegionPointerMove}
            onPointerLeave={handleRegionPointerLeave}
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
              const mode = getResizeModeAtPosition(event.clientX, event.clientY);
              if (mode) {
                startRegionInteraction(event, mode);
              }
            }}
          >
            {/* 遮罩层 */}
            <div className="absolute inset-0 bg-primary/20 shadow-[0_0_0_9999px_rgba(0,72,141,0.15)]" />

            {/* 边框 */}
            <div className="absolute inset-0 border-2 border-primary" />

            {/* 四个角手柄 */}
            {editable ? (
              <>
                {/* 左上角 */}
                <div
                  className="absolute -left-1.5 -top-1.5 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg cursor-nwse-resize hover:scale-125 transition-transform"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-nw")}
                />
                {/* 右上角 */}
                <div
                  className="absolute -right-1.5 -top-1.5 h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg cursor-nesw-resize hover:scale-125 transition-transform"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-ne")}
                />
                {/* 右下角 */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg cursor-nwse-resize hover:scale-125 transition-transform"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-se")}
                />
                {/* 左下角 */}
                <div
                  className="absolute -bottom-1.5 -left-1.5 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg cursor-nesw-resize hover:scale-125 transition-transform"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-sw")}
                />

                {/* 四边手柄 */}
                {/* 上边 */}
                <div
                  className="absolute left-1/2 -top-1 h-3 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 cursor-ns-resize hover:bg-primary hover:scale-110 transition-all"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-n")}
                />
                {/* 下边 */}
                <div
                  className="absolute left-1/2 -bottom-1 h-3 w-8 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/90 cursor-ns-resize hover:bg-primary hover:scale-110 transition-all"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-s")}
                />
                {/* 左边 */}
                <div
                  className="absolute -left-1 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 cursor-ew-resize hover:bg-primary hover:scale-110 transition-all"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-w")}
                />
                {/* 右边 */}
                <div
                  className="absolute -right-1 top-1/2 h-8 w-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 cursor-ew-resize hover:bg-primary hover:scale-110 transition-all"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-e")}
                />

                {/* 中心十字标记 */}
                <div className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/60" />
                <div className="absolute left-1/2 top-1/2 h-0.5 w-3 -translate-x-1/2 -translate-y-1/2 bg-white/60" />
              </>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/72 backdrop-blur-[2px]">
            <div className="rounded-2xl border border-primary/15 bg-white/95 px-5 py-4 text-center shadow-sm">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="mt-3 text-sm font-medium text-primary-strong">
                {loadingMessage ?? "正在刷新预览..."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
      {editable ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <p>
            {region
              ? "拖动圆点调整大小，拖动框内移动位置"
              : "点击图片快速创建选区，或使用右侧精确调整"}
          </p>
          {region && (
            <p className="text-xs text-muted/70">
              方向键移动 · Shift+方向键调整大小
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
