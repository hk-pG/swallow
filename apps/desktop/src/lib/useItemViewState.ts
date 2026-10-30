import type { ItemView } from "@swallow/shared";
import { type Dispatch, type SetStateAction, useState } from "react";

export interface ItemViewState {
  view: ItemView;
  setView: Dispatch<SetStateAction<ItemView>>;
}

/** Owns the active library view (all / folder / trash / …) for sidebar and browser. */
export function useItemViewState(): ItemViewState {
  const [view, setView] = useState<ItemView>({ kind: "all" });
  return { view, setView };
}
