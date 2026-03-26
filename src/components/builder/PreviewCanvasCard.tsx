import { useEffect, useRef, useState } from "react";
import type { Region } from "../../types";
import { clampRegion, getContainedRect } from "../../lib/region";

export function PreviewCanvasCard({
  title,
  image,
  region,
  selected,
  dimensions,
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
  editable?: boolean;
  onRegionChange?: (patch: Partial<Region>) => void;
  loading?: boolean;
  loadingMessage?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 320 });
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

  function startRegionInteraction(
    event: React.PointerEvent<HTMLDivElement>,
    mode: "move" | "resize-right" | "resize-bottom" | "resize-corner",
  ) {
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
        onRegionChange(
          clampRegion({
            x: initialRegion.x + dx,
            y: initialRegion.y + dy,
            width: initialRegion.width,
            height: initialRegion.height,
          }),
        );
        return;
      }

      const nextWidth =
        mode === "resize-bottom"
          ? initialRegion.width
          : Math.max(0.02, Math.min(1 - initialRegion.x, initialRegion.width + dx));
      const nextHeight =
        mode === "resize-right"
          ? initialRegion.height
          : Math.max(0.02, Math.min(1 - initialRegion.y, initialRegion.height + dy));

      onRegionChange(
        clampRegion({
          x: initialRegion.x,
          y: initialRegion.y,
          width: nextWidth,
          height: nextHeight,
        }),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
        onPointerDown={handleCanvasPointerDown}
      >
        {image ? (
          <img
            alt={title}
            className={`h-[320px] w-full object-contain transition duration-300 ${
              loading ? "scale-[0.985] opacity-45" : "opacity-100"
            }`}
            src={image}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted">暂无图像</div>
        )}
        {image && region && selected ? (
          <div
            className={`absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,72,141,0.14)] ${
              editable ? "cursor-move" : "pointer-events-none"
            }`}
            style={{
              left: `${contained.left + region.x * contained.width}px`,
              top: `${contained.top + region.y * contained.height}px`,
              width: `${region.width * contained.width}px`,
              height: `${region.height * contained.height}px`,
            }}
            onPointerDown={(event) => startRegionInteraction(event, "move")}
          >
            {editable ? (
              <>
                <div
                  className="absolute -right-1 top-1/2 h-12 w-3 -translate-y-1/2 rounded-full bg-primary/90"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-right")}
                />
                <div
                  className="absolute bottom-0 left-1/2 h-3 w-12 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/90"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-bottom")}
                />
                <div
                  className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-primary"
                  onPointerDown={(event) => startRegionInteraction(event, "resize-corner")}
                />
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
        <p className="mt-3 text-xs text-muted">
          {region
            ? "点击预览图可快速定位，拖动蓝色框可移动；右边、下边和右下角手柄可直接缩放区域。"
            : "当前没有选区。点击图片可快速创建一个区域，再继续调整。"}
        </p>
      ) : null}
    </section>
  );
}
