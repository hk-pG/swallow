use std::path::{Path, PathBuf};

use crate::app::state::AppState;
use crate::domain::library::{self, LibraryInfo};
use crate::domain::settings::SettingsDocument;

use super::error::CommandError;
use super::settings::settings_path;

fn activate(
    app: &tauri::AppHandle,
    state: &AppState,
    library: LibraryInfo,
) -> Result<LibraryInfo, CommandError> {
    let path = settings_path(app)?;
    let mut doc = SettingsDocument::load(&path);
    doc.settings.push_recent_library(&library.path);
    doc.save(&path).map_err(CommandError::Settings)?;
    *state.library.lock().unwrap() = Some(library.clone());
    Ok(library)
}

#[tauri::command]
pub fn create_library(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: PathBuf,
) -> Result<LibraryInfo, CommandError> {
    let library = library::create(&path)?;
    activate(&app, &state, library)
}

#[tauri::command]
pub fn open_library(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: PathBuf,
) -> Result<LibraryInfo, CommandError> {
    let library = library::open(&path)?;
    activate(&app, &state, library)
}

/// Returns the library already open in this process, otherwise reopens the most recently
/// used one. A library that can no longer be opened is dropped from the recent list so the
/// next launch starts clean.
#[tauri::command]
pub fn restore_library(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<LibraryInfo>, CommandError> {
    if let Some(library) = state.library.lock().unwrap().clone() {
        return Ok(Some(library));
    }
    let path = settings_path(&app)?;
    let mut doc = SettingsDocument::load(&path);
    let Some(last) = doc.settings.last_library().map(str::to_owned) else {
        return Ok(None);
    };
    match library::open(Path::new(&last)) {
        Ok(library) => activate(&app, &state, library).map(Some),
        Err(err) => {
            doc.settings.remove_recent_library(&last);
            doc.save(&path).map_err(CommandError::Settings)?;
            Err(err.into())
        }
    }
}

#[tauri::command]
pub fn recent_libraries(app: tauri::AppHandle) -> Result<Vec<String>, CommandError> {
    Ok(SettingsDocument::load(&settings_path(&app)?)
        .settings
        .recent_libraries)
}

#[cfg(test)]
mod tests {
    use crate::domain::library::LibraryInfo;

    #[test]
    fn library_info_serializes_with_shared_field_names() {
        let info = LibraryInfo {
            name: "lib".into(),
            path: "/libs/lib".into(),
        };
        assert_eq!(
            serde_json::to_value(&info).unwrap(),
            serde_json::json!({ "name": "lib", "path": "/libs/lib" })
        );
    }
}
