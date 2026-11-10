use std::path::PathBuf;

use crate::domain::folders;
use crate::domain::library::Folder;

use super::error::CommandError;

#[tauri::command]
pub fn list_folders(library_path: PathBuf) -> Result<Vec<Folder>, CommandError> {
    Ok(folders::list(&library_path)?)
}

#[tauri::command]
pub fn create_folder(
    library_path: PathBuf,
    parent_id: Option<String>,
    name: String,
) -> Result<Folder, CommandError> {
    Ok(folders::create(&library_path, parent_id.as_deref(), &name)?)
}

#[tauri::command]
pub fn rename_folder(
    library_path: PathBuf,
    id: String,
    name: String,
) -> Result<Folder, CommandError> {
    Ok(folders::rename(&library_path, &id, &name)?)
}

#[tauri::command]
pub fn move_folder(
    library_path: PathBuf,
    id: String,
    parent_id: Option<String>,
    index: Option<usize>,
) -> Result<Vec<Folder>, CommandError> {
    Ok(folders::move_to(
        &library_path,
        &id,
        parent_id.as_deref(),
        index,
    )?)
}

#[tauri::command]
pub fn delete_folder(library_path: PathBuf, id: String) -> Result<Vec<Folder>, CommandError> {
    Ok(folders::delete(&library_path, &id)?)
}

#[tauri::command]
pub fn assign_items(
    library_path: PathBuf,
    item_ids: Vec<String>,
    folder_id: String,
) -> Result<(), CommandError> {
    Ok(folders::assign_items(&library_path, &item_ids, &folder_id)?)
}

#[tauri::command]
pub fn unassign_items(
    library_path: PathBuf,
    item_ids: Vec<String>,
    folder_id: String,
) -> Result<(), CommandError> {
    Ok(folders::unassign_items(
        &library_path,
        &item_ids,
        &folder_id,
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::error::CommandError;
    use crate::domain::folders::FolderError;
    use crate::domain::item;
    use crate::domain::library;

    #[test]
    fn folder_commands_round_trip_and_surface_folder_errors() {
        let dir = tempfile::tempdir().unwrap();
        library::create(dir.path()).unwrap();
        let path = dir.path().to_path_buf();

        let photos = create_folder(path.clone(), None, " Photos ".into()).unwrap();
        assert_eq!(photos.name, "Photos");
        let cats = create_folder(path.clone(), Some(photos.id.clone()), "Cats".into()).unwrap();
        let listed = list_folders(path.clone()).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, photos.id);
        assert_eq!(listed[0].children, vec![cats.clone()]);

        let renamed = rename_folder(path.clone(), cats.id.clone(), "Kittens".into()).unwrap();
        assert_eq!(renamed.name, "Kittens");

        let moved = move_folder(path.clone(), cats.id.clone(), None, Some(0)).unwrap();
        assert_eq!(moved[0].id, cats.id);
        assert!(moved.iter().any(|folder| folder.id == photos.id));

        let sample = item::tests::sample_item("ITEM1", "pic", "png");
        item::tests::write_item(&path, &sample);
        assign_items(path.clone(), vec!["ITEM1".into()], photos.id.clone()).unwrap();
        assert_eq!(
            item::load_item(&path, "ITEM1").unwrap().folders,
            vec![photos.id.clone()]
        );
        unassign_items(path.clone(), vec!["ITEM1".into()], photos.id.clone()).unwrap();
        assert!(item::load_item(&path, "ITEM1").unwrap().folders.is_empty());

        let err = create_folder(path.clone(), None, " ".into()).unwrap_err();
        assert_eq!(err.to_string(), "フォルダ名を入力してください");
        assert_eq!(
            serde_json::to_value(&err).unwrap(),
            serde_json::json!("フォルダ名を入力してください")
        );
        assert!(matches!(
            assign_items(path.clone(), vec!["ITEM1".into()], "missing".into()),
            Err(CommandError::Folder(FolderError::FolderNotFound(_)))
        ));

        let left = delete_folder(path, photos.id).unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].id, cats.id);
    }
}
