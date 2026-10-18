import {
  COLOR_LABEL_NAMES,
  COLOR_LABEL_SWATCH,
  COLOR_LABELS,
  type ColorLabel,
  type ItemView,
} from "@swallow/shared";

export function ColorLabelNav({
  view,
  onChange,
  disabled,
}: {
  view: ItemView;
  onChange: (view: ItemView) => void;
  disabled?: boolean;
}) {
  const active = (colorLabel: ColorLabel | null) =>
    view.kind === "colorLabel" && view.colorLabel === colorLabel;

  return (
    <nav className="color-label-nav">
      <button
        type="button"
        className="nav-item color-label-nav-item"
        aria-current={active(null) ? "page" : undefined}
        disabled={disabled}
        onClick={() => onChange({ kind: "colorLabel", colorLabel: null })}
      >
        <span className="color-label-dot none" aria-hidden="true" />
        ラベルなし
      </button>
      {COLOR_LABELS.map((label) => (
        <button
          key={label}
          type="button"
          className="nav-item color-label-nav-item"
          aria-current={active(label) ? "page" : undefined}
          disabled={disabled}
          onClick={() => onChange({ kind: "colorLabel", colorLabel: label })}
        >
          <span
            className="color-label-dot"
            style={{ background: COLOR_LABEL_SWATCH[label] }}
            aria-hidden="true"
          />
          {COLOR_LABEL_NAMES[label]}
        </button>
      ))}
    </nav>
  );
}
