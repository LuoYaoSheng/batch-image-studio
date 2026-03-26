import type { ImportedImage } from "../../types";
import { formatBytes } from "../../lib/formatting";

type PreviewTaskState = {
  taskId: string;
  stage: "started" | "model-loading" | "processing" | "saving" | "completed" | "error";
  message: string;
};

export function ImageSampleList({
  items,
  selectedImageId,
  onSelect,
  previewTaskStateByImageId,
}: {
  items: ImportedImage[];
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.id}
          className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition ${
            selectedImageId === item.id
              ? "border-primary bg-primary/8"
              : "border-line bg-white hover:border-primary-strong"
          }`}
          type="button"
          onClick={() => onSelect(item.id)}
        >
          <img
            alt={item.name}
            className="h-16 w-16 rounded-xl border border-line object-cover"
            src={item.thumbnailDataUrl}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium">{item.name}</p>
              {previewTaskStateByImageId[item.id] ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {previewTaskStateByImageId[item.id]?.stage === "completed"
                    ? "已缓存"
                    : previewTaskStateByImageId[item.id]?.stage === "error"
                      ? "失败"
                      : "处理中"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">
              {item.width} × {item.height} · {item.format.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted">{formatBytes(item.fileSize)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
