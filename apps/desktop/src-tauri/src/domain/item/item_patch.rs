use std::fs;
use std::path::Path;

use super::item_io::{item_dir, item_dirs, item_file, load_item, read_item, save_item};
use super::{ItemError, ItemMetadata, ItemMetadataPatch, MAX_STAR, lock_items};

fn edit_and_save(
    item_dir: &Path,
    mut item: ItemMetadata,
    edit: &mut impl FnMut(&mut ItemMetadata),
) -> std::io::Result<()> {
    let before = item.clone();
    edit(&mut item);
    if item == before {
        return Ok(());
    }
    save_item(item_dir, &item)
}

/// Applies `edit` to each item and saves the ones it changed. Every item is loaded before
/// any is written, so an invalid or unknown id leaves all items untouched.
pub fn edit_items(
    library: &Path,
    ids: &[String],
    mut edit: impl FnMut(&mut ItemMetadata),
) -> Result<(), ItemError> {
    let _lock = lock_items();
    let items = ids
        .iter()
        .map(|id| Ok((load_item(library, id)?, item_dir(library, id))))
        .collect::<Result<Vec<_>, ItemError>>()?;
    for (item, dir) in items {
        edit_and_save(&dir, item, &mut edit)?;
    }
    Ok(())
}

/// Applies `edit` to every item in the library and saves the ones it changed.
pub fn edit_all_items(
    library: &Path,
    mut edit: impl FnMut(&mut ItemMetadata),
) -> Result<(), ItemError> {
    let _lock = lock_items();
    for dir in item_dirs(library)? {
        if dir.join(super::ITEM_METADATA_FILE).is_file() {
            let item = read_item(&dir)?;
            edit_and_save(&dir, item, &mut edit)?;
        }
    }
    Ok(())
}

pub fn apply_patch(
    item: &mut ItemMetadata,
    patch: ItemMetadataPatch,
    now: i64,
) -> Result<(), ItemError> {
    if let Some(star) = patch.star
        && star > MAX_STAR
    {
        return Err(ItemError::InvalidStar(star));
    }
    let name = match patch.name {
        Some(name) => {
            let name = name.trim().to_owned();
            // The name doubles as the stored file name, see `item_file`.
            if name.is_empty() || Path::new(&name).file_name() != Some(name.as_ref()) {
                return Err(ItemError::InvalidName);
            }
            Some(name)
        }
        None => None,
    };

    let mut changed = false;
    if let Some(name) = name
        && name != item.name
    {
        item.name = name;
        changed = true;
    }
    if let Some(annotation) = patch.annotation
        && annotation != item.annotation
    {
        item.annotation = annotation;
        changed = true;
    }
    if let Some(star) = patch.star
        && star != item.star
    {
        item.star = star;
        changed = true;
    }
    if let Some(color_label) = patch.color_label
        && color_label != item.color_label
    {
        item.color_label = color_label;
        changed = true;
    }
    if let Some(url) = patch.url {
        let url = Some(url.trim().to_owned()).filter(|u| !u.is_empty());
        if url != item.url {
            item.url = url;
            changed = true;
        }
    }
    if changed {
        item.modified_at = now;
    }
    Ok(())
}

/// Applies `patch` and persists it. Renaming also renames the stored file.
pub fn update_item(
    library: &Path,
    id: &str,
    patch: ItemMetadataPatch,
    now: i64,
) -> Result<ItemMetadata, ItemError> {
    let _lock = lock_items();
    let mut item = load_item(library, id)?;
    let before = item.clone();
    apply_patch(&mut item, patch, now)?;
    if item == before {
        return Ok(item);
    }
    let dir = item_dir(library, id);
    let renamed = item.name != before.name;
    let (from, to) = (item_file(&dir, &before)?, item_file(&dir, &item)?);
    if renamed {
        fs::rename(&from, &to)?;
    }
    if let Err(e) = save_item(&dir, &item) {
        if renamed {
            let _ = fs::rename(&to, &from);
        }
        return Err(e.into());
    }
    Ok(item)
}
