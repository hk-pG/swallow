import type { AppInfo as AppInfoData } from "@swallow/shared";
import { useEffect, useState } from "react";
import { getAppInfo } from "../lib/commands";

/** App name and version in the inspector footer. */
export function AppInfo() {
  const [info, setInfo] = useState<AppInfoData | null>(null);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
  }, []);

  if (!info) return null;

  return (
    <p className="app-info">
      {info.name} v{info.version}
    </p>
  );
}
