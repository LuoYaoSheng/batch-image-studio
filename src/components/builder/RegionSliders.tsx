import type { Region } from "../../types";
import { clampPercent, formatPercent } from "../../lib/region";

export function RegionSliders({
  region,
  onChange,
}: {
  region: Region;
  onChange: (patch: Partial<Region>) => void;
}) {
  const controls: Array<{ key: keyof Region; label: string; min: number; max: number; step: number }> = [
    { key: "x", label: "X 起点", min: 0, max: 0.95, step: 0.01 },
    { key: "y", label: "Y 起点", min: 0, max: 0.95, step: 0.01 },
    { key: "width", label: "宽度", min: 0.02, max: 0.98, step: 0.01 },
    { key: "height", label: "高度", min: 0.02, max: 0.98, step: 0.01 },
  ];

  return (
    <div className="space-y-4">
      {controls.map((control) => (
        <label key={control.key} className="block">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{control.label}</span>
            <span className="font-mono text-xs text-muted">{formatPercent(region[control.key])}%</span>
          </div>
          <input
            className="w-full accent-primary"
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={region[control.key]}
            onChange={(event) =>
              onChange({
                [control.key]: clampPercent(Number(event.target.value)),
              } as Partial<Region>)
            }
          />
        </label>
      ))}
    </div>
  );
}
