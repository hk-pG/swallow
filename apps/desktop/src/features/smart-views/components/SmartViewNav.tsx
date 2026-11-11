import { FAVORITES_MIN_STAR, type ItemView, type SmartViewKind } from "@swallow/shared";

const SMART_VIEWS: { kind: SmartViewKind; label: string; title?: string }[] = [
  { kind: "all", label: "全アイテム" },
  {
    kind: "favorites",
    label: "お気に入り",
    title: `星 ${FAVORITES_MIN_STAR} 以上の固定ビュー（スマートフォルダとは別）`,
  },
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
      {SMART_VIEWS.map(({ kind, label, title }) => (
        <button
          key={kind}
          type="button"
          className="nav-item"
          aria-current={view.kind === kind ? "page" : undefined}
          title={title}
          disabled={disabled}
          onClick={() => onChange({ kind })}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
