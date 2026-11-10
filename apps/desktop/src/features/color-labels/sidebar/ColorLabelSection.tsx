import type { SidebarSectionProps } from "../../sidebar/lib/types";
import { ColorLabelNav } from "../components/ColorLabelNav";

export function ColorLabelSection({ view, onViewChange, disabled }: SidebarSectionProps) {
  return <ColorLabelNav view={view} onChange={onViewChange} disabled={disabled} />;
}
