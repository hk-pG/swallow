use std::path::PathBuf;

use crate::domain::library::LibraryTags;
use crate::domain::tags;

use super::error::CommandError;

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
