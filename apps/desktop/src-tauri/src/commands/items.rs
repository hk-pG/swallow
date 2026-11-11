use std::path::PathBuf;

use crate::domain::item::{self, ItemError, ItemMetadata, ItemMetadataPatch};
use crate::domain::reveal;

use super::error::CommandError;

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

#[tauri::command]
pub fn update_items(
    library_path: PathBuf,
    item_ids: Vec<String>,
    patch: ItemMetadataPatch,
) -> Result<(), CommandError> {
    Ok(item::update_items(
        &library_path,
        &item_ids,
        patch,
        item::now_millis(),
    )?)
}

#[tauri::command]
pub fn trash_items(library_path: PathBuf, item_ids: Vec<String>) -> Result<(), CommandError> {
    Ok(item::set_items_deleted(
        &library_path,
        &item_ids,
        true,
        item::now_millis(),
    )?)
}

#[tauri::command]
pub fn restore_items(library_path: PathBuf, item_ids: Vec<String>) -> Result<(), CommandError> {
    Ok(item::set_items_deleted(
        &library_path,
        &item_ids,
        false,
        item::now_millis(),
    )?)
}

#[tauri::command]
pub async fn purge_items(library_path: PathBuf, item_ids: Vec<String>) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || item::purge_items(&library_path, &item_ids))
        .await??;
    Ok(())
}

#[tauri::command]
pub fn reveal_item_in_explorer(library_path: PathBuf, item_id: String) -> Result<(), CommandError> {
    let meta = item::load_item(&library_path, &item_id)?;
    let dir = item::item_dir(&library_path, &item_id);
    let file = item::item_file(&dir, &meta).map_err(ItemError::from)?;
    reveal::reveal_in_file_manager(&file).map_err(CommandError::Reveal)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::color_label::ColorLabel;
    use crate::domain::library;

    #[test]
    fn update_items_sets_color_label_on_each_id() {
        let dir = tempfile::tempdir().unwrap();
        library::create(dir.path()).unwrap();
        let path = dir.path().to_path_buf();
        for id in ["ITEM1", "ITEM2"] {
            let sample = item::tests::sample_item(id, "pic", "png");
            item::tests::write_item(&path, &sample);
        }
        let patch = item::ItemMetadataPatch {
            color_label: Some(Some(ColorLabel::Red)),
            ..Default::default()
        };
        update_items(path.clone(), vec!["ITEM1".into(), "ITEM2".into()], patch).unwrap();
        assert_eq!(
            item::load_item(&path, "ITEM1").unwrap().color_label,
            Some(ColorLabel::Red)
        );
        assert_eq!(
            item::load_item(&path, "ITEM2").unwrap().color_label,
            Some(ColorLabel::Red)
        );
    }

    #[test]
    fn reveal_item_in_explorer_resolves_stored_file_path() {
        let dir = tempfile::tempdir().unwrap();
        library::create(dir.path()).unwrap();
        let path = dir.path().to_path_buf();
        let sample = item::tests::sample_item("ITEM1", "pic", "png");
        let item_dir = item::tests::write_item(&path, &sample);
        std::fs::write(item_dir.join("pic.png"), b"x").unwrap();

        reveal_item_in_explorer(path, "ITEM1".into()).expect("reveal should spawn");
    }
}
