import { AppLayout } from "./AppLayout";
import { AppProviders } from "./AppProviders";
import { useAppSession } from "./useAppSession";

export function App() {
  const session = useAppSession();
  return (
    <AppProviders session={session}>
      <AppLayout session={session} />
    </AppProviders>
  );
}
