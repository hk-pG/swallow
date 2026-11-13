import { COLOR_LABEL_SWATCH, type ColorLabel } from "@swallow/shared";

/** グリッド・リストのサムネイル上に載せるカラーラベルスウォッチ（`items.css` の `.grid-color-label`）。 */
export function ItemThumbColorLabel({ colorLabel }: { colorLabel: ColorLabel }) {
  return (
    <span
      className="grid-color-label"
      style={{ background: COLOR_LABEL_SWATCH[colorLabel] }}
      aria-hidden="true"
      title="カラーラベル"
    />
  );
}
