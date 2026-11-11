import type { ReactNode } from "react";
import { composeAppFeatureProviders } from "./appFeatureProviders";
import type { AppSession } from "./useAppSession";

export { APP_FEATURE_PROVIDERS, assertUniqueAppFeatureProviderIds } from "./appFeatureProviders";

export function AppProviders({ session, children }: { session: AppSession; children: ReactNode }) {
  return <>{composeAppFeatureProviders(session, children)}</>;
}
