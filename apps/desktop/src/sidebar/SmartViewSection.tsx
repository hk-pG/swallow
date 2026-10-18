import { SmartViewNav } from "../components/SmartViewNav";
import type { SidebarSectionProps } from "./types";

/** First sidebar section: smart views. */
export function SmartViewSection({ view, onViewChange, disabled }: SidebarSectionProps) {
  return (
    <section className="sidebar-section sidebar-section-first" aria-label="ビュー">
      <div className="sidebar-section-header">
        <h2 className="sidebar-section-title">ビュー</h2>
      </div>
      <SmartViewNav view={view} onChange={onViewChange} disabled={disabled} />
    </section>
  );
}
