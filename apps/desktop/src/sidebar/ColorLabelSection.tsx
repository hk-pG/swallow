import { ColorLabelNav } from "../components/ColorLabelNav";
import { SidebarSection } from "../components/SidebarSection";
import type { SidebarSectionProps } from "./types";

export function ColorLabelSection({ view, onViewChange, disabled }: SidebarSectionProps) {
  return (
    <SidebarSection title="カラーラベル">
      <ColorLabelNav view={view} onChange={onViewChange} disabled={disabled} />
    </SidebarSection>
  );
}
