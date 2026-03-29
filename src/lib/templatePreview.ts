import { convertFileSrc } from "@tauri-apps/api/core";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isDirectImageSource(value: string) {
  return (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}

export function resolveTemplatePreviewSrc(previewImage?: string | null) {
  if (!previewImage) {
    return null;
  }

  if (isDirectImageSource(previewImage)) {
    return previewImage;
  }

  if (!isTauriRuntime()) {
    return null;
  }

  return convertFileSrc(previewImage);
}
