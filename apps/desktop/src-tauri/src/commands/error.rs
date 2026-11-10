use serde::Serialize;

use crate::domain::folders::FolderError;
use crate::domain::import::ImportError;
use crate::domain::item::ItemError;
use crate::domain::library::LibraryError;
use crate::domain::smart_folders::SmartFolderError;
use crate::domain::tags::TagError;

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error(transparent)]
    Library(#[from] LibraryError),
    #[error(transparent)]
    Item(#[from] ItemError),
    #[error(transparent)]
    Folder(#[from] FolderError),
    #[error(transparent)]
    Tag(#[from] TagError),
    #[error(transparent)]
    SmartFolder(#[from] SmartFolderError),
    #[error(transparent)]
    Import(#[from] ImportError),
    #[error("設定を保存できません: {0}")]
    Settings(#[source] std::io::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error("ファイルマネージャーで表示できません: {0}")]
    Reveal(#[source] std::io::Error),
}

impl Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
