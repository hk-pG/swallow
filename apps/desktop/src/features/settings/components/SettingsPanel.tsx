import { useState } from "react";
import type { AppearanceSettingsState } from "../hooks/useAppearanceSettings";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import { SessionDiagnosticLogPanel } from "./SessionDiagnosticLogPanel";

type SettingsTabId = "appearance" | "developer";

export interface SettingsPanelProps {
  appearance: AppearanceSettingsState;
}

export function SettingsPanel({ appearance }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTabId>("appearance");

  return (
    <section className="inspector-section settings-panel" aria-label="設定">
      <h3>設定</h3>
      <div className="view-mode-toggle settings-panel-tabs" role="tablist" aria-label="設定タブ">
        <button
          type="button"
          role="tab"
          id="settings-tab-appearance"
          className="view-mode-button"
          aria-selected={tab === "appearance"}
          onClick={() => setTab("appearance")}
        >
          表示
        </button>
        <button
          type="button"
          role="tab"
          id="settings-tab-developer"
          className="view-mode-button"
          aria-selected={tab === "developer"}
          onClick={() => setTab("developer")}
        >
          開発者
        </button>
      </div>
      {tab === "appearance" ? (
        <div role="tabpanel" aria-labelledby="settings-tab-appearance">
          <AppearanceSwitcher
            themeId={appearance.themeId}
            colorScheme={appearance.colorScheme}
            onThemeIdChange={appearance.setThemeId}
            onColorSchemeChange={appearance.setColorScheme}
          />
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="settings-tab-developer">
          <SessionDiagnosticLogPanel />
        </div>
      )}
    </section>
  );
}
