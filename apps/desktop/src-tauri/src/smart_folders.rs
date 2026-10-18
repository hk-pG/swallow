use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::library::{SMART_FOLDERS_FILE, write_json_atomic};

/// Mirrors `SmartFolderTagMatch` in `packages/shared/src/smartFolders.ts`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SmartFolderTagMatch {
    #[default]
    All,
    Any,
}

/// Mirrors `SmartFolderCriteria` in `packages/shared/src/smartFolders.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolderCriteria {
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub tag_match: SmartFolderTagMatch,
    pub folder_id: Option<String>,
    pub min_star: Option<u8>,
}

/// Mirrors `SmartFolder` in `packages/shared/src/smartFolders.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolder {
    pub id: String,
    pub name: String,
    pub criteria: SmartFolderCriteria,
}

/// Mirrors `SmartFolderLibrary` in `packages/shared/src/smartFolders.ts`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolderLibrary {
    #[serde(default)]
    pub folders: Vec<SmartFolder>,
}

#[derive(Debug, thiserror::Error)]
pub enum SmartFolderError {
    #[error("スマートフォルダ名を入力してください")]
    EmptyName,
    #[error("スマートフォルダが見つかりません: {0}")]
    NotFound(String),
    #[error("星の値は 0 から 5 の範囲で指定してください")]
    InvalidStar,
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
}

type Result<T> = std::result::Result<T, SmartFolderError>;

fn normalize_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(SmartFolderError::EmptyName);
    }
    Ok(name.to_owned())
}

fn validate_criteria(criteria: &SmartFolderCriteria) -> Result<()> {
    if let Some(star) = criteria.min_star
        && star > crate::item::MAX_STAR
    {
        return Err(SmartFolderError::InvalidStar);
    }
    Ok(())
}

pub fn load(root: &Path) -> Result<SmartFolderLibrary> {
    match fs::read(root.join(SMART_FOLDERS_FILE)) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(SmartFolderLibrary::default()),
        Err(e) => Err(e.into()),
    }
}

fn save(root: &Path, library: &SmartFolderLibrary) -> Result<()> {
    Ok(write_json_atomic(&root.join(SMART_FOLDERS_FILE), library)?)
}

fn update(
    root: &Path,
    f: impl FnOnce(&mut SmartFolderLibrary) -> Result<()>,
) -> Result<SmartFolderLibrary> {
    let mut library = load(root)?;
    f(&mut library)?;
    save(root, &library)?;
    Ok(library)
}

pub fn list(root: &Path) -> Result<Vec<SmartFolder>> {
    Ok(load(root)?.folders)
}

pub fn create(root: &Path, name: &str, criteria: SmartFolderCriteria) -> Result<SmartFolder> {
    let name = normalize_name(name)?;
    validate_criteria(&criteria)?;
    let folder = SmartFolder {
        id: ulid::Ulid::generate().to_string(),
        name,
        criteria,
    };
    update(root, |library| {
        library.folders.push(folder.clone());
        Ok(())
    })?;
    Ok(folder)
}

pub fn rename(root: &Path, id: &str, name: &str) -> Result<SmartFolder> {
    let name = normalize_name(name)?;
    let mut library = load(root)?;
    let folder = library
        .folders
        .iter_mut()
        .find(|f| f.id == id)
        .ok_or_else(|| SmartFolderError::NotFound(id.to_owned()))?;
    folder.name = name;
    let renamed = folder.clone();
    save(root, &library)?;
    Ok(renamed)
}

pub fn update_criteria(
    root: &Path,
    id: &str,
    criteria: SmartFolderCriteria,
) -> Result<SmartFolder> {
    validate_criteria(&criteria)?;
    let mut library = load(root)?;
    let folder = library
        .folders
        .iter_mut()
        .find(|f| f.id == id)
        .ok_or_else(|| SmartFolderError::NotFound(id.to_owned()))?;
    folder.criteria = criteria;
    let updated = folder.clone();
    save(root, &library)?;
    Ok(updated)
}

pub fn delete(root: &Path, id: &str) -> Result<Vec<SmartFolder>> {
    update(root, |library| {
        let before = library.folders.len();
        library.folders.retain(|f| f.id != id);
        if library.folders.len() == before {
            return Err(SmartFolderError::NotFound(id.to_owned()));
        }
        Ok(())
    })
    .map(|library| library.folders)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::IMAGES_DIR;

    fn library() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join(IMAGES_DIR)).unwrap();
        std::fs::write(
            dir.path().join(crate::library::METADATA_FILE),
            r#"{ "name": "lib", "version": 1, "folders": [] }"#,
        )
        .unwrap();
        std::fs::write(
            dir.path().join(crate::library::TAGS_FILE),
            r#"{ "tags": [], "groups": [] }"#,
        )
        .unwrap();
        dir
    }

    #[test]
    fn missing_file_loads_as_empty() {
        let lib = library();
        assert!(load(lib.path()).unwrap().folders.is_empty());
    }

    #[test]
    fn create_rename_update_and_delete_persist() {
        let lib = library();
        let created = create(
            lib.path(),
            " Favorites ",
            SmartFolderCriteria {
                min_star: Some(1),
                ..SmartFolderCriteria::default()
            },
        )
        .unwrap();
        assert_eq!(created.name, "Favorites");

        rename(lib.path(), &created.id, "Stars").unwrap();
        update_criteria(
            lib.path(),
            &created.id,
            SmartFolderCriteria {
                query: "logo".into(),
                tags: vec!["brand".into()],
                tag_match: SmartFolderTagMatch::Any,
                folder_id: None,
                min_star: Some(3),
            },
        )
        .unwrap();

        let folders = list(lib.path()).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].name, "Stars");
        assert_eq!(folders[0].criteria.query, "logo");

        let left = delete(lib.path(), &created.id).unwrap();
        assert!(left.is_empty());
        assert!(load(lib.path()).unwrap().folders.is_empty());
    }

    #[test]
    fn rejects_blank_name_and_invalid_star() {
        let lib = library();
        assert!(matches!(
            create(lib.path(), "  ", SmartFolderCriteria::default()),
            Err(SmartFolderError::EmptyName)
        ));
        assert!(matches!(
            create(
                lib.path(),
                "x",
                SmartFolderCriteria {
                    min_star: Some(9),
                    ..SmartFolderCriteria::default()
                },
            ),
            Err(SmartFolderError::InvalidStar)
        ));
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let folder = SmartFolder {
            id: "SF1".into(),
            name: "n".into(),
            criteria: SmartFolderCriteria {
                query: "q".into(),
                tags: vec!["t".into()],
                tag_match: SmartFolderTagMatch::All,
                folder_id: Some("F1".into()),
                min_star: Some(2),
            },
        };
        assert_eq!(
            serde_json::to_value(&folder).unwrap(),
            serde_json::json!({
                "id": "SF1",
                "name": "n",
                "criteria": {
                    "query": "q",
                    "tags": ["t"],
                    "tagMatch": "all",
                    "folderId": "F1",
                    "minStar": 2
                }
            })
        );
    }
}
