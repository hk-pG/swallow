use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const IMAGES_DIR: &str = "images";
pub const ITEM_DIR_EXT: &str = "info";
pub const ITEM_METADATA_FILE: &str = "metadata.json";

/// Mirrors `ItemMetadata` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemMetadata {
    pub id: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub tags: Vec<String>,
    pub folders: Vec<String>,
    pub annotation: String,
    pub star: u8,
    pub url: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    pub is_deleted: bool,
}

/// `images/<id>.info`
pub fn item_dir(library: &Path, id: &str) -> PathBuf {
    library
        .join(IMAGES_DIR)
        .join(format!("{id}.{ITEM_DIR_EXT}"))
}

/// `images/<id>.info/<name>.<ext>`
pub fn item_file(item_dir: &Path, item: &ItemMetadata) -> io::Result<PathBuf> {
    let file_name = format!("{}.{}", item.name, item.ext);
    if Path::new(&file_name).file_name() != Some(file_name.as_ref()) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid item file name: {file_name}"),
        ));
    }
    Ok(item_dir.join(file_name))
}

pub fn read_item(item_dir: &Path) -> io::Result<ItemMetadata> {
    let json = fs::read(item_dir.join(ITEM_METADATA_FILE))?;
    serde_json::from_slice(&json).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// Items in the library, newest first. Unreadable item directories are skipped.
pub fn read_items(library: &Path) -> io::Result<Vec<ItemMetadata>> {
    let entries = match fs::read_dir(library.join(IMAGES_DIR)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut items = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path.extension().is_none_or(|ext| ext != ITEM_DIR_EXT) {
            continue;
        }
        match read_item(&path) {
            Ok(item) => items.push(item),
            Err(e) => eprintln!("skipping item {}: {e}", path.display()),
        }
    }
    items.sort_by_key(|item| std::cmp::Reverse(item.created_at));
    Ok(items)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub fn sample_item(id: &str, name: &str, ext: &str) -> ItemMetadata {
        ItemMetadata {
            id: id.into(),
            name: name.into(),
            ext: ext.into(),
            size: 0,
            width: None,
            height: None,
            tags: Vec::new(),
            folders: Vec::new(),
            annotation: String::new(),
            star: 0,
            url: None,
            created_at: 0,
            modified_at: 0,
            is_deleted: false,
        }
    }

    pub fn write_item(library: &Path, item: &ItemMetadata) -> PathBuf {
        let dir = item_dir(library, &item.id);
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join(ITEM_METADATA_FILE),
            serde_json::to_vec(item).unwrap(),
        )
        .unwrap();
        dir
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let json = serde_json::to_value(sample_item("01J", "cat", "png")).unwrap();
        let keys: Vec<_> = json.as_object().unwrap().keys().cloned().collect();
        for key in ["createdAt", "modifiedAt", "isDeleted"] {
            assert!(keys.contains(&key.to_string()), "missing {key}");
        }
    }

    #[test]
    fn read_items_sorts_newest_first_and_skips_broken() {
        let library = tempfile::tempdir().unwrap();
        let mut old = sample_item("A", "old", "png");
        old.created_at = 1;
        let mut new = sample_item("B", "new", "png");
        new.created_at = 2;
        write_item(library.path(), &old);
        write_item(library.path(), &new);
        let broken = item_dir(library.path(), "C");
        fs::create_dir_all(&broken).unwrap();
        fs::write(broken.join(ITEM_METADATA_FILE), "{").unwrap();
        fs::create_dir_all(library.path().join(IMAGES_DIR).join("unrelated")).unwrap();

        let ids: Vec<_> = read_items(library.path())
            .unwrap()
            .into_iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(ids, ["B", "A"]);
    }

    #[test]
    fn read_items_without_images_dir_is_empty() {
        let library = tempfile::tempdir().unwrap();
        assert!(read_items(library.path()).unwrap().is_empty());
    }

    #[test]
    fn item_file_rejects_path_separators() {
        let dir = Path::new("lib/images/A.info");
        assert!(item_file(dir, &sample_item("A", "../evil", "png")).is_err());
        assert_eq!(
            item_file(dir, &sample_item("A", "cat", "png")).unwrap(),
            dir.join("cat.png")
        );
    }
}
