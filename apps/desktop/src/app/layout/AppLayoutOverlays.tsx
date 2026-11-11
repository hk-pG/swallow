import { QuickLook } from "../../features/quick-look";
import type { AppSessionLibrary } from "../session/useAppSessionLibrary";
import type { AppSessionWorkspace } from "../session/useAppSessionWorkspace";

export function AppLayoutOverlays({
  library,
  workspace,
}: {
  library: AppSessionLibrary;
  workspace: AppSessionWorkspace;
}) {
  const { libraryPath } = library;
  const { quickLook } = workspace;

  if (!quickLook.isOpen || !quickLook.target || !libraryPath) {
    return null;
  }

  return (
    <QuickLook
      key={quickLook.target.item.id}
      libraryPath={libraryPath}
      target={quickLook.target}
      scaleMode={quickLook.scaleMode}
      onScaleModeChange={quickLook.setScaleMode}
      onClose={quickLook.close}
      onPrev={quickLook.goPrev}
      onNext={quickLook.goNext}
    />
  );
}
