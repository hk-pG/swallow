import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Library header の直後。上ボーダーを付けない。 */
  first?: boolean;
  className?: string;
  /** 見出し末尾の作成操作。リストの上に常設フォームは置かない。 */
  headerAction?: ReactNode;
  children: ReactNode;
}

/** Sidebar section shell: header, then rows. Same structure for every block. */
export function SidebarSection({ title, first = false, className, headerAction, children }: Props) {
  const sectionClass = ["sidebar-section", first ? "sidebar-section-first" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={sectionClass} aria-label={title}>
      <div className="sidebar-section-header">
        <h2 className="sidebar-section-title">{title}</h2>
        {headerAction}
      </div>
      {children}
    </section>
  );
}
