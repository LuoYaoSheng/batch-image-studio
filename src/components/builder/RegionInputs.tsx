import type { Region } from "../../types";
import { formatPercent, parsePercentInput } from "../../lib/region";

export function RegionInputs({
  region,
  onChange,
}: {
  region: Region;
  onChange: (patch: Partial<Region>) => void;
}) {
  const fields: Array<{ key: keyof Region; label: string }> = [
    { key: "x", label: "X%" },
    { key: "y", label: "Y%" },
    { key: "width", label: "W%" },
    { key: "height", label: "H%" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <label key={field.key} className="block">
          <span className="mb-2 block text-xs font-medium text-muted">{field.label}</span>
          <input
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            type="number"
            min={1}
            max={98}
            step={1}
            value={formatPercent(region[field.key])}
            onChange={(event) => {
              const next = parsePercentInput(event.target.value);
              if (next === null) {
                return;
              }
              onChange({ [field.key]: next } as Partial<Region>);
            }}
          />
        </label>
      ))}
    </div>
  );
}
