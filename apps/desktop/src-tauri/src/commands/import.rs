use std::path::PathBuf;

use crate::domain::import::{self, ImportReport};

use super::error::CommandError;

#[tauri::command]
pub async fn import_assets(
    library_path: PathBuf,
    paths: Vec<PathBuf>,
) -> Result<ImportReport, CommandError> {
    let report =
        tauri::async_runtime::spawn_blocking(move || import::import_files(&library_path, &paths))
            .await??;
    Ok(report)
}
