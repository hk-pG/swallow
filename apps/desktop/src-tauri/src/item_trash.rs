use std::fs;
use std::io;
use std::path::Path;

use super::item_io::{item_dir, load_item};
use super::item_patch::edit_items;
use super::{ItemError, lock_items};

/// Moves items to the trash (`deleted = true`) or restores them. Stored files are kept.
pub fn set_items_deleted(
    library: &Path,
    ids: &[String],
    deleted: bool,
    now: i64,
) -> Result<(), ItemError> {
    edit_items(library, ids, |item| {
        if item.is_deleted != deleted {
            item.is_deleted = deleted;
            item.modified_at = now;
        }
    })
}

/// Removes `images/<id>.info/` of items in the trash. Every item is checked before any is
/// removed, so an unknown id or an item outside the trash leaves all items untouched.
pub fn purge_items(library: &Path, ids: &[String]) -> Result<(), ItemError> {
    let _lock = lock_items();
    for id in ids {
        if !load_item(library, id)?.is_deleted {
            return Err(ItemError::NotInTrash(id.clone()));
        }
    }
    for id in ids {
        match fs::remove_dir_all(item_dir(library, id)) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e.into()),
            _ => {}
        }
    }
    Ok(())
}
