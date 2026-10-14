import { SmartViewNav } from "../components/SmartViewNav";
import type { SidebarSectionProps } from "./types";

/** First sidebar section: smart views. */
export function SmartViewSection({ view, onViewChange, disabled }: SidebarSectionProps) {
  return <SmartViewNav view={view} onChange={onViewChange} disabled={disabled} />;
}
