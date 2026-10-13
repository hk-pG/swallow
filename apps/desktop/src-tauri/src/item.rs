use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

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

#[derive(Debug)]
pub enum ItemError {
    InvalidId(String),
    InvalidName,
    InvalidStar(u8),
    NotFound(String),
    Io(io::Error),
    Json(serde_json::Error),
}

impl std::fmt::Display for ItemError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidId(id) => write!(f, "invalid item id: {id}"),
            Self::InvalidName => write!(f, "name must not be empty"),
            Self::InvalidStar(star) => write!(f, "star must be 0-{MAX_STAR}, got {star}"),
            Self::NotFound(id) => write!(f, "item not found: {id}"),
            Self::Io(e) => write!(f, "{e}"),
            Self::Json(e) => write!(f, "invalid metadata.json: {e}"),
        }
    }
}

impl std::error::Error for ItemError {}

impl From<io::Error> for ItemError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

impl From<serde_json::Error> for ItemError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}

fn metadata_path(library: &Path, id: &str) -> Result<PathBuf, ItemError> {
    // ULIDs are alphanumeric; rejecting anything else keeps `id` from escaping `images/`.
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ItemError::InvalidId(id.to_owned()));
    }
    Ok(library
        .join("images")
        .join(format!("{id}.info"))
        .join("metadata.json"))
}

pub fn read_item(library: &Path, id: &str) -> Result<ItemMetadata, ItemError> {
    let path = metadata_path(library, id)?;
    let json = fs::read_to_string(&path).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => ItemError::NotFound(id.to_owned()),
        _ => ItemError::Io(e),
    })?;
    Ok(serde_json::from_str(&json)?)
}

fn write_item(library: &Path, item: &ItemMetadata) -> Result<(), ItemError> {
    let path = metadata_path(library, &item.id)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(item)?)?;
    fs::rename(&tmp, &path)?;
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
            if name.is_empty() {
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

pub fn update_item(
    library: &Path,
    id: &str,
    patch: ItemMetadataPatch,
    now: i64,
) -> Result<ItemMetadata, ItemError> {
    let mut item = read_item(library, id)?;
    let before = item.clone();
    apply_patch(&mut item, patch, now)?;
    if item != before {
        write_item(library, &item)?;
    }
    Ok(item)
}

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> ItemMetadata {
        ItemMetadata {
            id: "01HZXAMPLE0000000000000000".into(),
            name: "photo".into(),
            ext: "png".into(),
            size: 1024,
            width: Some(640),
            height: Some(480),
            tags: vec!["sky".into()],
            folders: vec![],
            annotation: String::new(),
            star: 0,
            url: None,
            created_at: 1,
            modified_at: 1,
            is_deleted: false,
        }
    }

    struct TempLibrary(PathBuf);

    impl TempLibrary {
        fn new(label: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "swallow-item-test-{label}-{}-{}",
                std::process::id(),
                now_millis()
            ));
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }

        fn with_item(label: &str, item: &ItemMetadata) -> Self {
            let lib = Self::new(label);
            fs::create_dir_all(lib.0.join("images").join(format!("{}.info", item.id))).unwrap();
            write_item(&lib.0, item).unwrap();
            lib
        }
    }

    impl Drop for TempLibrary {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let json = serde_json::to_value(sample()).unwrap();
        let keys: Vec<_> = json.as_object().unwrap().keys().cloned().collect();
        for key in ["createdAt", "modifiedAt", "isDeleted"] {
            assert!(keys.contains(&key.to_owned()), "missing {key}");
        }
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
        let patch = ItemMetadataPatch {
            name: Some(" ".into()),
            ..Default::default()
        };
        assert!(matches!(
            apply_patch(&mut item, patch, 99),
            Err(ItemError::InvalidName)
        ));
        assert_eq!(item, sample());
    }

    #[test]
    fn rejects_path_traversal_ids() {
        let lib = TempLibrary::new("traversal");
        for id in ["", "../x", "a/b", "a\\b", "a.b"] {
            assert!(matches!(
                read_item(&lib.0, id),
                Err(ItemError::InvalidId(_))
            ));
        }
    }

    #[test]
    fn update_persists_to_metadata_json() {
        let item = sample();
        let lib = TempLibrary::with_item("persist", &item);
        let patch = ItemMetadataPatch {
            star: Some(3),
            ..Default::default()
        };
        let updated = update_item(&lib.0, &item.id, patch, 42).unwrap();
        assert_eq!(updated.star, 3);
        assert_eq!(read_item(&lib.0, &item.id).unwrap(), updated);
    }

    #[test]
    fn missing_item_is_not_found() {
        let lib = TempLibrary::new("missing");
        assert!(matches!(
            read_item(&lib.0, "01HZMISSING"),
            Err(ItemError::NotFound(_))
        ));
    }
}
