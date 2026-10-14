use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::library::{IMAGES_DIR, METADATA_FILE, write_json_atomic};

pub const ITEM_DIR_EXT: &str = "info";
pub const ITEM_METADATA_FILE: &str = METADATA_FILE;
pub const MAX_STAR: u8 = 5;

/// Mirrors `ItemMetadata` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

/// Mirrors `ItemMetadataPatch` in `packages/shared/src/library.ts`.
/// An empty `url` clears it.
#[derive(Debug, Default, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ItemMetadataPatch {
    pub name: Option<String>,
    pub annotation: Option<String>,
    pub star: Option<u8>,
    pub url: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ItemError {
    #[error("invalid item id: {0}")]
    InvalidId(String),
    #[error("name must not be empty or contain path separators")]
    InvalidName,
    #[error("star must be 0-{MAX_STAR}, got {0}")]
    InvalidStar(u8),
    #[error("item not found: {0}")]
    NotFound(String),
    #[error("item is not in the trash: {0}")]
    NotInTrash(String),
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("invalid metadata.json: {0}")]
    Json(#[from] serde_json::Error),
}

/// Every read-modify-write of an item's `metadata.json` holds this, so concurrent
/// updates to the same item cannot overwrite each other.
static ITEM_WRITE_LOCK: Mutex<()> = Mutex::new(());

fn lock_items() -> MutexGuard<'static, ()> {
    ITEM_WRITE_LOCK
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
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

/// Every `images/*.info` directory, whether or not its metadata is readable.
fn item_dirs(library: &Path) -> io::Result<Vec<PathBuf>> {
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

fn save_item(item_dir: &Path, item: &ItemMetadata) -> io::Result<()> {
    write_json_atomic(&item_dir.join(ITEM_METADATA_FILE), item)
}

fn edit_and_save(
    item_dir: &Path,
    mut item: ItemMetadata,
    edit: &mut impl FnMut(&mut ItemMetadata),
) -> io::Result<()> {
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
        if dir.join(ITEM_METADATA_FILE).is_file() {
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

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
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

    fn sample() -> ItemMetadata {
        ItemMetadata {
            size: 1024,
            width: Some(640),
            height: Some(480),
            tags: vec!["sky".into()],
            created_at: 1,
            modified_at: 1,
            ..sample_item("01HZXAMPLE0000000000000000", "photo", "png")
        }
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let item = ItemMetadata {
            id: "01J0000000000000000000000".into(),
            name: "photo".into(),
            ext: "png".into(),
            size: 10,
            width: Some(2),
            height: None,
            tags: vec![],
            folders: vec![],
            annotation: String::new(),
            star: 0,
            url: None,
            created_at: 1,
            modified_at: 2,
            is_deleted: false,
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "id": "01J0000000000000000000000",
                "name": "photo",
                "ext": "png",
                "size": 10,
                "width": 2,
                "height": null,
                "tags": [],
                "folders": [],
                "annotation": "",
                "star": 0,
                "url": null,
                "createdAt": 1,
                "modifiedAt": 2,
                "isDeleted": false
            })
        );
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

    #[test]
    fn patch_updates_fields_and_modified_at() {
        let mut item = sample();
        let patch = ItemMetadataPatch {
            name: Some("  renamed ".into()),
            annotation: Some("note".into()),
            star: Some(4),
            url: Some(" https://example.com ".into()),
        };
        apply_patch(&mut item, patch, 99).unwrap();
        assert_eq!(item.name, "renamed");
        assert_eq!(item.annotation, "note");
        assert_eq!(item.star, 4);
        assert_eq!(item.url.as_deref(), Some("https://example.com"));
        assert_eq!(item.modified_at, 99);
    }

    #[test]
    fn noop_patch_keeps_modified_at() {
        let mut item = sample();
        let patch = ItemMetadataPatch {
            name: Some("photo".into()),
            ..Default::default()
        };
        apply_patch(&mut item, patch, 99).unwrap();
        assert_eq!(item.modified_at, 1);
    }

    #[test]
    fn empty_url_clears_it() {
        let mut item = ItemMetadata {
            url: Some("https://example.com".into()),
            ..sample()
        };
        let patch = ItemMetadataPatch {
            url: Some("  ".into()),
            ..Default::default()
        };
        apply_patch(&mut item, patch, 99).unwrap();
        assert_eq!(item.url, None);
    }

    #[test]
    fn rejects_invalid_patch_without_partial_update() {
        let mut item = sample();
        let patch = ItemMetadataPatch {
            annotation: Some("note".into()),
            star: Some(6),
            ..Default::default()
        };
        assert!(matches!(
            apply_patch(&mut item, patch, 99),
            Err(ItemError::InvalidStar(6))
        ));
        for name in [" ", "a/b", ".."] {
            let patch = ItemMetadataPatch {
                name: Some(name.into()),
                ..Default::default()
            };
            assert!(matches!(
                apply_patch(&mut item, patch, 99),
                Err(ItemError::InvalidName)
            ));
        }
        assert_eq!(item, sample());
    }

    #[test]
    fn rejects_path_traversal_ids() {
        let library = tempfile::tempdir().unwrap();
        for id in ["", "../x", "a/b", "a\\b", "a.b"] {
            assert!(matches!(
                load_item(library.path(), id),
                Err(ItemError::InvalidId(_))
            ));
        }
    }

    #[test]
    fn update_persists_to_metadata_json() {
        let library = tempfile::tempdir().unwrap();
        let item = sample();
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("photo.png"), "x").unwrap();
        let patch = ItemMetadataPatch {
            star: Some(3),
            ..Default::default()
        };
        let updated = update_item(library.path(), &item.id, patch, 42).unwrap();
        assert_eq!(updated.star, 3);
        assert_eq!(load_item(library.path(), &item.id).unwrap(), updated);
    }

    #[test]
    fn rename_moves_stored_file() {
        let library = tempfile::tempdir().unwrap();
        let item = sample();
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("photo.png"), "x").unwrap();
        let patch = ItemMetadataPatch {
            name: Some("sunset".into()),
            ..Default::default()
        };
        update_item(library.path(), &item.id, patch, 42).unwrap();
        assert!(!dir.join("photo.png").exists());
        assert_eq!(fs::read_to_string(dir.join("sunset.png")).unwrap(), "x");
        assert_eq!(read_item(&dir).unwrap().name, "sunset");
    }

    #[test]
    fn concurrent_edits_to_one_item_are_not_lost() {
        let library = tempfile::tempdir().unwrap();
        let item = sample();
        write_item(library.path(), &item);
        let ids = [item.id.clone()];

        std::thread::scope(|s| {
            for i in 0..8 {
                let (library, ids) = (library.path(), &ids);
                s.spawn(move || {
                    edit_items(library, ids, |item| item.folders.push(format!("F{i}"))).unwrap();
                });
            }
        });

        assert_eq!(
            load_item(library.path(), &item.id).unwrap().folders.len(),
            8
        );
    }

    #[test]
    fn trash_and_restore_keep_stored_file() {
        let library = tempfile::tempdir().unwrap();
        let item = sample();
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("photo.png"), "x").unwrap();
        let ids = [item.id.clone()];

        set_items_deleted(library.path(), &ids, true, 42).unwrap();
        let trashed = load_item(library.path(), &item.id).unwrap();
        assert!(trashed.is_deleted);
        assert_eq!(trashed.modified_at, 42);
        assert!(dir.join("photo.png").is_file());

        set_items_deleted(library.path(), &ids, false, 43).unwrap();
        let restored = load_item(library.path(), &item.id).unwrap();
        assert!(!restored.is_deleted);
        assert_eq!(restored.modified_at, 43);
    }

    #[test]
    fn trashing_unknown_id_changes_nothing() {
        let library = tempfile::tempdir().unwrap();
        let item = sample();
        write_item(library.path(), &item);
        let ids = [item.id.clone(), "01HZMISSING".into()];
        assert!(matches!(
            set_items_deleted(library.path(), &ids, true, 42),
            Err(ItemError::NotFound(_))
        ));
        assert_eq!(load_item(library.path(), &item.id).unwrap(), item);
    }

    #[test]
    fn purge_removes_item_dir_of_trashed_items() {
        let library = tempfile::tempdir().unwrap();
        let item = ItemMetadata {
            is_deleted: true,
            ..sample()
        };
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("photo.png"), "x").unwrap();

        purge_items(library.path(), std::slice::from_ref(&item.id)).unwrap();
        assert!(!dir.exists());
        assert!(read_items(library.path()).unwrap().is_empty());
    }

    #[test]
    fn purge_refuses_items_outside_trash() {
        let library = tempfile::tempdir().unwrap();
        let trashed = ItemMetadata {
            is_deleted: true,
            ..sample_item("A", "a", "png")
        };
        let kept = sample_item("B", "b", "png");
        let trashed_dir = write_item(library.path(), &trashed);
        let kept_dir = write_item(library.path(), &kept);

        let ids = [trashed.id.clone(), kept.id.clone()];
        assert!(matches!(
            purge_items(library.path(), &ids),
            Err(ItemError::NotInTrash(id)) if id == "B"
        ));
        assert!(trashed_dir.exists());
        assert!(kept_dir.exists());
        assert!(matches!(
            purge_items(library.path(), &["../x".into()]),
            Err(ItemError::InvalidId(_))
        ));
    }

    #[test]
    fn missing_item_is_not_found() {
        let library = tempfile::tempdir().unwrap();
        assert!(matches!(
            load_item(library.path(), "01HZMISSING"),
            Err(ItemError::NotFound(_))
        ));
    }
}
