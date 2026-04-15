import { memo } from "react";
import type { ImportedImage } from "../../types";

type PreviewTaskState = {
  taskId: string;
  stage: "started" | "model-loading" | "processing" | "saving" | "completed" | "error";
  message: string;
};

const ImageSampleRow = memo(function ImageSampleRow({
  item,
  isSelected,
  taskState,
  onSelect,
  onRemove,
}: {
  item: ImportedImage;
  isSelected: boolean;
  taskState?: PreviewTaskState;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-2.5 transition ${
        isSelected ? "border-primary bg-primary/8" : "border-line bg-white hover:border-primary-strong"
      }`}
    >
      <div className="flex gap-2">
        <button className="flex min-w-0 flex-1 gap-2.5 text-left" type="button" onClick={() => onSelect(item.id)}>
          <img
            alt={item.name}
            className="h-14 w-14 rounded-xl border border-line object-cover"
            decoding="async"
            loading="lazy"
            src={item.thumbnailDataUrl}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-[13px] font-medium leading-5 text-ink">{item.name}</p>
              {taskState ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {taskState.stage === "completed" ? "已缓存" : taskState.stage === "error" ? "失败" : "处理中"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {item.width} × {item.height}
            </p>
          </div>
        </button>
        {onRemove ? (
          <button
            className="shrink-0 rounded-xl border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-muted hover:text-[#9a2020]"
            type="button"
            onClick={() => onRemove(item.id)}
          >
            移除
          </button>
        ) : null}
      </div>
    </div>
  );
});

export const ImageSampleList = memo(function ImageSampleList({
  items,
  selectedImageId,
  onSelect,
  onRemove,
  previewTaskStateByImageId,
}: {
  items: ImportedImage[];
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  previewTaskStateByImageId: Record<string, PreviewTaskState | undefined>;
}) {
  // Sort items by filename for consistent display order
  const sortedItems = items.length > 1 ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : items;

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => (
        <ImageSampleRow
          key={item.id}
          item={item}
          isSelected={selectedImageId === item.id}
          taskState={previewTaskStateByImageId[item.id]}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
});
