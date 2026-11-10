use std::path::PathBuf;

use crate::domain::smart_folders::{self, SmartFolder, SmartFolderCriteria};

use super::error::CommandError;

#[tauri::command]
pub fn list_smart_folders(library_path: PathBuf) -> Result<Vec<SmartFolder>, CommandError> {
    Ok(smart_folders::list(&library_path)?)
}

#[tauri::command]
pub fn create_smart_folder(
    library_path: PathBuf,
    name: String,
    criteria: SmartFolderCriteria,
) -> Result<SmartFolder, CommandError> {
    Ok(smart_folders::create(&library_path, &name, criteria)?)
}

#[tauri::command]
pub fn rename_smart_folder(
    library_path: PathBuf,
    id: String,
    name: String,
) -> Result<SmartFolder, CommandError> {
    Ok(smart_folders::rename(&library_path, &id, &name)?)
}

#[tauri::command]
pub fn update_smart_folder(
    library_path: PathBuf,
    id: String,
    criteria: SmartFolderCriteria,
) -> Result<SmartFolder, CommandError> {
    Ok(smart_folders::update_criteria(
        &library_path,
        &id,
        criteria,
    )?)
}

#[tauri::command]
pub fn delete_smart_folder(
    library_path: PathBuf,
    id: String,
) -> Result<Vec<SmartFolder>, CommandError> {
    Ok(smart_folders::delete(&library_path, &id)?)
}
