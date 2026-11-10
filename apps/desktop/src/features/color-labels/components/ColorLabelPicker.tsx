import {
  COLOR_LABEL_NAMES,
  COLOR_LABEL_SWATCH,
  COLOR_LABELS,
  type ColorLabel,
} from "@swallow/shared";
import type { CSSProperties } from "react";

export function ColorLabelPicker({
  value,
  onChange,
}: {
  value: ColorLabel | null;
  onChange: (colorLabel: ColorLabel | null) => void;
}) {
  return (
    <div className="inspector-field">
      <span className="inspector-label">カラーラベル</span>
      <div className="color-label-picker">
        <button
          type="button"
          className={value === null ? "color-label-swatch active" : "color-label-swatch none"}
          title="ラベルなし"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          <span className="color-label-none-mark" aria-hidden="true">
            ∅
          </span>
        </button>
        {COLOR_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            className={value === label ? "color-label-swatch active" : "color-label-swatch"}
            style={{ "--swatch": COLOR_LABEL_SWATCH[label] } as CSSProperties}
            title={COLOR_LABEL_NAMES[label]}
            aria-label={COLOR_LABEL_NAMES[label]}
            aria-pressed={value === label}
            onClick={() => onChange(value === label ? null : label)}
          />
        ))}
      </div>
    </div>
  );
}
