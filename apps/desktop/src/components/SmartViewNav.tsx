import type { ItemView, SmartViewKind } from "@swallow/shared";

const SMART_VIEWS: { kind: SmartViewKind; label: string }[] = [
  { kind: "all", label: "全アイテム" },
  { kind: "uncategorized", label: "未分類" },
  { kind: "trash", label: "ゴミ箱" },
];

interface Props {
  view: ItemView;
  onChange: (view: ItemView) => void;
  disabled?: boolean;
}

export function SmartViewNav({ view, onChange, disabled }: Props) {
  return (
    <nav>
      {SMART_VIEWS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className="nav-item"
          aria-current={view.kind === kind ? "page" : undefined}
          disabled={disabled}
          onClick={() => onChange({ kind })}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
