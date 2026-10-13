use std::path::Path;

use serde::Serialize;

use crate::item::{self, ItemMetadata, ItemMetadataPatch};

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
pub fn get_item(library_path: String, id: String) -> Result<ItemMetadata, String> {
    item::read_item(Path::new(&library_path), &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_item(
    library_path: String,
    id: String,
    patch: ItemMetadataPatch,
) -> Result<ItemMetadata, String> {
    item::update_item(Path::new(&library_path), &id, patch, item::now_millis())
        .map_err(|e| e.to_string())
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
