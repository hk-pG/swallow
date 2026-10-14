use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Mirrors `LIBRARY_VERSION` in `packages/shared/src/library.ts`.
pub const LIBRARY_VERSION: u32 = 1;

const METADATA_FILE: &str = "metadata.json";
const TAGS_FILE: &str = "tags.json";
pub const IMAGES_DIR: &str = "images";

/// Mirrors `Folder` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub children: Vec<Folder>,
}

/// Mirrors `LibraryMetadata` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibraryMetadata {
    pub name: String,
    pub version: u32,
    pub folders: Vec<Folder>,
}

/// Mirrors `TagGroup` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TagGroup {
    pub id: String,
    pub name: String,
    pub tags: Vec<String>,
}

/// Mirrors `LibraryTags` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibraryTags {
    pub tags: Vec<String>,
    pub groups: Vec<TagGroup>,
}

/// Mirrors `LibraryInfo` in `packages/shared/src/api.ts`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LibraryInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, thiserror::Error)]
pub enum LibraryError {
    #[error("フォルダが空ではありません: {0}")]
    NotEmpty(PathBuf),
    #[error("Swallow ライブラリではありません: {0}")]
    NotALibrary(PathBuf),
    #[error("ライブラリのバージョン {found} には対応していません（対応: {LIBRARY_VERSION}）")]
    UnsupportedVersion { found: u32 },
    #[error("ライブラリ名を決められません: {0}")]
    InvalidName(PathBuf),
    #[error("{path}: {source}")]
    Io { path: PathBuf, source: io::Error },
    #[error("{path}: {source}")]
    Json {
        path: PathBuf,
        source: serde_json::Error,
    },
}

impl Serialize for LibraryError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn io_err(path: &Path) -> impl FnOnce(io::Error) -> LibraryError + '_ {
    move |source| LibraryError::Io {
        path: path.to_path_buf(),
        source,
    }
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), LibraryError> {
    let json = serde_json::to_vec_pretty(value).map_err(|source| LibraryError::Json {
        path: path.to_path_buf(),
        source,
    })?;
    fs::write(path, json).map_err(io_err(path))
}

fn info(path: &Path, metadata: &LibraryMetadata) -> LibraryInfo {
    LibraryInfo {
        name: metadata.name.clone(),
        path: path.to_string_lossy().into_owned(),
    }
}

/// Initializes a new library in `path`, which must be missing or empty.
/// The library is named after the directory.
pub fn create(path: &Path) -> Result<LibraryInfo, LibraryError> {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| LibraryError::InvalidName(path.to_path_buf()))?
        .to_owned();

    if path.exists() {
        let mut entries = fs::read_dir(path).map_err(io_err(path))?;
        if entries.next().is_some() {
            return Err(LibraryError::NotEmpty(path.to_path_buf()));
        }
    }

    let images = path.join(IMAGES_DIR);
    fs::create_dir_all(&images).map_err(io_err(&images))?;

    let metadata = LibraryMetadata {
        name,
        version: LIBRARY_VERSION,
        folders: Vec::new(),
    };
    write_json(&path.join(METADATA_FILE), &metadata)?;
    write_json(&path.join(TAGS_FILE), &LibraryTags::default())?;

    Ok(info(path, &metadata))
}

/// Opens an existing library after validating its layout and format version.
pub fn open(path: &Path) -> Result<LibraryInfo, LibraryError> {
    let metadata_path = path.join(METADATA_FILE);
    if !metadata_path.is_file()
        || !path.join(TAGS_FILE).is_file()
        || !path.join(IMAGES_DIR).is_dir()
    {
        return Err(LibraryError::NotALibrary(path.to_path_buf()));
    }

    let raw = fs::read(&metadata_path).map_err(io_err(&metadata_path))?;

    #[derive(Deserialize)]
    struct Versioned {
        version: u32,
    }
    let versioned: Versioned =
        serde_json::from_slice(&raw).map_err(|_| LibraryError::NotALibrary(path.to_path_buf()))?;
    if versioned.version != LIBRARY_VERSION {
        return Err(LibraryError::UnsupportedVersion {
            found: versioned.version,
        });
    }

    let metadata: LibraryMetadata =
        serde_json::from_slice(&raw).map_err(|source| LibraryError::Json {
            path: metadata_path,
            source,
        })?;
    Ok(info(path, &metadata))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_initializes_layout() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("My Library");

        let created = create(&path).unwrap();

        assert_eq!(created.name, "My Library");
        assert!(path.join(IMAGES_DIR).is_dir());
        let metadata: serde_json::Value =
            serde_json::from_slice(&fs::read(path.join(METADATA_FILE)).unwrap()).unwrap();
        assert_eq!(
            metadata,
            serde_json::json!({ "name": "My Library", "version": LIBRARY_VERSION, "folders": [] })
        );
        let tags: serde_json::Value =
            serde_json::from_slice(&fs::read(path.join(TAGS_FILE)).unwrap()).unwrap();
        assert_eq!(tags, serde_json::json!({ "tags": [], "groups": [] }));
    }

    #[test]
    fn create_accepts_existing_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(create(dir.path()).is_ok());
    }

    #[test]
    fn create_rejects_non_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "x").unwrap();
        assert!(matches!(create(dir.path()), Err(LibraryError::NotEmpty(_))));
    }

    #[test]
    fn open_returns_created_library() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("lib");
        let created = create(&path).unwrap();
        assert_eq!(open(&path).unwrap(), created);
    }

    #[test]
    fn open_rejects_plain_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            open(dir.path()),
            Err(LibraryError::NotALibrary(_))
        ));
    }

    #[test]
    fn open_rejects_unsupported_version() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("lib");
        create(&path).unwrap();
        fs::write(
            path.join(METADATA_FILE),
            r#"{ "name": "lib", "version": 999, "folders": [] }"#,
        )
        .unwrap();
        assert!(matches!(
            open(&path),
            Err(LibraryError::UnsupportedVersion { found: 999 })
        ));
    }
}
