import { ColorLabelNav } from "../components/ColorLabelNav";
import type { SidebarSectionProps } from "./types";

export function ColorLabelSection({ view, onViewChange, disabled }: SidebarSectionProps) {
  return <ColorLabelNav view={view} onChange={onViewChange} disabled={disabled} />;
}
