use std::path::PathBuf;

use tauri::Manager;

use crate::domain::settings::{SETTINGS_FILE, Settings, SettingsDocument, SettingsPatch};

use super::error::CommandError;

pub(crate) fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, CommandError> {
    Ok(app.path().app_config_dir()?.join(SETTINGS_FILE))
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<Settings, CommandError> {
    Ok(SettingsDocument::load(&settings_path(&app)?).settings)
}

#[tauri::command]
pub fn update_settings(
    app: tauri::AppHandle,
    patch: SettingsPatch,
) -> Result<Settings, CommandError> {
    let path = settings_path(&app)?;
    let mut doc = SettingsDocument::load(&path);
    doc.apply_patch(patch);
    doc.save(&path).map_err(CommandError::Settings)?;
    Ok(doc.settings)
}
