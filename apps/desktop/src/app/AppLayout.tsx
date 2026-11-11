import { AppLayoutInspector } from "./layout/AppLayoutInspector";
import { AppLayoutMain } from "./layout/AppLayoutMain";
import { AppLayoutOverlays } from "./layout/AppLayoutOverlays";
import { AppLayoutSidebar } from "./layout/AppLayoutSidebar";
import type { AppSession } from "./useAppSession";

export function AppLayout({ session }: { session: AppSession }) {
  const { library, browser, workspace } = session;

  return (
    <div className="layout">
      <AppLayoutSidebar library={library} browser={browser} />
      <AppLayoutMain library={library} browser={browser} workspace={workspace} />
      <AppLayoutInspector library={library} browser={browser} workspace={workspace} />
      <AppLayoutOverlays library={library} workspace={workspace} />
    </div>
  );
}
