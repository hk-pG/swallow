use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

use crate::import::{self, ImportError, ImportReport};
use crate::item::{self, ItemError, ItemMetadata, ItemMetadataPatch};
use crate::library::{self, LibraryError, LibraryInfo, LibraryTags};
use crate::settings::{SETTINGS_FILE, Settings};
use crate::tags::{self, TagError};

/// Mirrors `AppInfo` in `packages/shared/src/api.ts`.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[derive(Default)]
pub struct AppState {
    pub library: Mutex<Option<LibraryInfo>>,
}

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error(transparent)]
    Library(#[from] LibraryError),
    #[error(transparent)]
    Item(#[from] ItemError),
    #[error(transparent)]
    Tag(#[from] TagError),
    #[error(transparent)]
    Import(#[from] ImportError),
    #[error("設定を保存できません: {0}")]
    Settings(#[source] std::io::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

impl Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> AppInfo {
    let pkg = app.package_info();
    AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
    }
}

#[tauri::command]
pub fn get_library_tags(library_path: PathBuf) -> Result<LibraryTags, CommandError> {
    Ok(tags::load(&library_path)?)
}

#[tauri::command]
pub fn add_tag(library_path: PathBuf, tag: String) -> Result<LibraryTags, CommandError> {
    Ok(tags::add_tag(&library_path, &tag)?)
}

#[tauri::command]
pub fn remove_tag(library_path: PathBuf, tag: String) -> Result<LibraryTags, CommandError> {
    Ok(tags::remove_tag(&library_path, &tag)?)
}

#[tauri::command]
pub fn create_tag_group(library_path: PathBuf, name: String) -> Result<LibraryTags, CommandError> {
    Ok(tags::create_tag_group(&library_path, &name)?)
}

#[tauri::command]
pub fn delete_tag_group(
    library_path: PathBuf,
    group_id: String,
) -> Result<LibraryTags, CommandError> {
    Ok(tags::delete_tag_group(&library_path, &group_id)?)
}

#[tauri::command]
pub fn set_tag_group(
    library_path: PathBuf,
    tag: String,
    group_id: Option<String>,
) -> Result<LibraryTags, CommandError> {
    Ok(tags::set_tag_group(
        &library_path,
        &tag,
        group_id.as_deref(),
    )?)
}

#[tauri::command]
pub fn add_item_tags(
    library_path: PathBuf,
    item_ids: Vec<String>,
    tags: Vec<String>,
) -> Result<LibraryTags, CommandError> {
    Ok(tags::add_item_tags(&library_path, &item_ids, &tags)?)
}

#[tauri::command]
pub fn remove_item_tags(
    library_path: PathBuf,
    item_ids: Vec<String>,
    tags: Vec<String>,
) -> Result<(), CommandError> {
    Ok(tags::remove_item_tags(&library_path, &item_ids, &tags)?)
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, CommandError> {
    Ok(app.path().app_config_dir()?.join(SETTINGS_FILE))
}

fn activate(
    app: &tauri::AppHandle,
    state: &AppState,
    library: LibraryInfo,
) -> Result<LibraryInfo, CommandError> {
    let path = settings_path(app)?;
    let mut settings = Settings::load(&path);
    settings.push_recent_library(&library.path);
    settings.save(&path).map_err(CommandError::Settings)?;
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
    let mut settings = Settings::load(&path);
    let Some(last) = settings.last_library().map(str::to_owned) else {
        return Ok(None);
    };
    match library::open(Path::new(&last)) {
        Ok(library) => activate(&app, &state, library).map(Some),
        Err(err) => {
            settings.remove_recent_library(&last);
            settings.save(&path).map_err(CommandError::Settings)?;
            Err(err.into())
        }
    }
}

#[tauri::command]
pub fn recent_libraries(app: tauri::AppHandle) -> Result<Vec<String>, CommandError> {
    Ok(Settings::load(&settings_path(&app)?).recent_libraries)
}

#[tauri::command]
pub async fn import_assets(
    library_path: PathBuf,
    paths: Vec<PathBuf>,
) -> Result<ImportReport, CommandError> {
    let report =
        tauri::async_runtime::spawn_blocking(move || import::import_files(&library_path, &paths))
            .await??;
    Ok(report)
}

#[tauri::command]
pub async fn list_items(library_path: PathBuf) -> Result<Vec<ItemMetadata>, CommandError> {
    let items = tauri::async_runtime::spawn_blocking(move || item::read_items(&library_path))
        .await?
        .map_err(ItemError::from)?;
    Ok(items)
}

#[tauri::command]
pub fn get_item(library_path: PathBuf, id: String) -> Result<ItemMetadata, CommandError> {
    Ok(item::load_item(&library_path, &id)?)
}

#[tauri::command]
pub fn update_item(
    library_path: PathBuf,
    id: String,
    patch: ItemMetadataPatch,
) -> Result<ItemMetadata, CommandError> {
    Ok(item::update_item(
        &library_path,
        &id,
        patch,
        item::now_millis(),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_serializes_with_shared_field_names() {
        let info = AppInfo {
            name: "Swallow".into(),
            version: "0.1.0".into(),
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "name": "Swallow", "version": "0.1.0" })
        );
    }

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
