import type { Region } from "../types";

export function clampPercent(value: number) {
  return Math.max(0.01, Math.min(0.98, value));
}

export function clampRegion(region: Region): Region {
  const width = clampPercent(region.width);
  const height = clampPercent(region.height);
  const x = Math.max(0, Math.min(1 - width, region.x));
  const y = Math.max(0, Math.min(1 - height, region.y));

  return { x, y, width, height };
}

export function formatPercent(value: number) {
  return Math.round(value * 100);
}

export function parsePercentInput(value: string) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return clampPercent(numeric / 100);
}

export function getContainedRect(
  bounds: { width: number; height: number },
  dimensions?: { width: number; height: number },
) {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const imageAspect = dimensions.width / dimensions.height;
  const frameAspect = bounds.width / bounds.height;

  if (imageAspect > frameAspect) {
    const width = bounds.width;
    const height = width / imageAspect;
    return {
      left: 0,
      top: (bounds.height - height) / 2,
      width,
      height,
    };
  }

  const height = bounds.height;
  const width = height * imageAspect;
  return {
    left: (bounds.width - width) / 2,
    top: 0,
    width,
    height,
  };
}
