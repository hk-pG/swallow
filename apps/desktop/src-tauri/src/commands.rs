use crate::library::{self, ItemMetadata};
use serde::Serialize;
use std::path::PathBuf;

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
pub async fn list_items(library_path: PathBuf) -> Result<Vec<ItemMetadata>, String> {
    tauri::async_runtime::spawn_blocking(move || library::read_items(&library_path))
        .await
        .map_err(|e| e.to_string())?
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
