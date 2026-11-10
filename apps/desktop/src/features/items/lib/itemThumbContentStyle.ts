import { thumbnailSizePx } from "@swallow/shared";
import type { CSSProperties } from "react";

/** CSS variables for list/grid thumbnail sizing on the main content pane. */
export function itemThumbContentStyle(thumbnailSizeIndex: number): CSSProperties {
  return {
    "--item-thumb-size": `${thumbnailSizePx(thumbnailSizeIndex)}px`,
  } as CSSProperties;
}
