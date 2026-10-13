use std::path::PathBuf;

use serde::Serialize;

use crate::tags::{self, LibraryTags, TagError};

/// Mirrors `AppInfo` in `packages/shared/src/api.ts`.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
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
pub fn get_library_tags(library_path: PathBuf) -> Result<LibraryTags, TagError> {
    tags::load(&library_path)
}

#[tauri::command]
pub fn add_tag(library_path: PathBuf, tag: String) -> Result<LibraryTags, TagError> {
    tags::add_tag(&library_path, &tag)
}

#[tauri::command]
pub fn remove_tag(library_path: PathBuf, tag: String) -> Result<LibraryTags, TagError> {
    tags::remove_tag(&library_path, &tag)
}

#[tauri::command]
pub fn create_tag_group(library_path: PathBuf, name: String) -> Result<LibraryTags, TagError> {
    tags::create_tag_group(&library_path, &name)
}

#[tauri::command]
pub fn delete_tag_group(library_path: PathBuf, group_id: String) -> Result<LibraryTags, TagError> {
    tags::delete_tag_group(&library_path, &group_id)
}

#[tauri::command]
pub fn set_tag_group(
    library_path: PathBuf,
    tag: String,
    group_id: Option<String>,
) -> Result<LibraryTags, TagError> {
    tags::set_tag_group(&library_path, &tag, group_id.as_deref())
}

#[tauri::command]
pub fn add_item_tags(
    library_path: PathBuf,
    item_ids: Vec<String>,
    tags: Vec<String>,
) -> Result<LibraryTags, TagError> {
    tags::add_item_tags(&library_path, &item_ids, &tags)
}

#[tauri::command]
pub fn remove_item_tags(
    library_path: PathBuf,
    item_ids: Vec<String>,
    tags: Vec<String>,
) -> Result<(), TagError> {
    tags::remove_item_tags(&library_path, &item_ids, &tags)
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
}
