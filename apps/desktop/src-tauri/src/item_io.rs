use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::library::{IMAGES_DIR, write_json_atomic};

use super::{ITEM_DIR_EXT, ITEM_METADATA_FILE, ItemError, ItemMetadata};

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

/// Every `images/*.info` directory, whether or not its metadata is readable.
pub(super) fn item_dirs(library: &Path) -> io::Result<Vec<PathBuf>> {
    let entries = match fs::read_dir(library.join(IMAGES_DIR)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut dirs = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path.extension().is_some_and(|ext| ext == ITEM_DIR_EXT) {
            dirs.push(path);
        }
    }
    Ok(dirs)
}

/// Items in the library, newest first. Unreadable item directories are skipped.
pub fn read_items(library: &Path) -> io::Result<Vec<ItemMetadata>> {
    let mut items = Vec::new();
    for path in item_dirs(library)? {
        match read_item(&path) {
            Ok(item) => items.push(item),
            Err(e) => eprintln!("skipping item {}: {e}", path.display()),
        }
    }
    items.sort_by_key(|item| std::cmp::Reverse(item.created_at));
    Ok(items)
}

fn checked_item_dir(library: &Path, id: &str) -> Result<PathBuf, ItemError> {
    // ULIDs are alphanumeric; rejecting anything else keeps `id` from escaping `images/`.
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ItemError::InvalidId(id.to_owned()));
    }
    Ok(item_dir(library, id))
}

pub fn load_item(library: &Path, id: &str) -> Result<ItemMetadata, ItemError> {
    let path = checked_item_dir(library, id)?.join(ITEM_METADATA_FILE);
    let json = fs::read_to_string(&path).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => ItemError::NotFound(id.to_owned()),
        _ => ItemError::Io(e),
    })?;
    Ok(serde_json::from_str(&json)?)
}

pub(super) fn save_item(item_dir: &Path, item: &ItemMetadata) -> io::Result<()> {
    write_json_atomic(&item_dir.join(ITEM_METADATA_FILE), item)
}
