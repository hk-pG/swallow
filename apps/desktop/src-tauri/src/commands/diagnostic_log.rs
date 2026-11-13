use serde::Serialize;
use tauri::Manager;

use crate::app::state::AppState;
use crate::infra::diagnostic_log::{SESSION_LOG_READ_MAX_BYTES, read_session_log_tail};

use super::error::CommandError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDiagnosticLog {
    pub text: String,
    pub truncated: bool,
    pub max_bytes: usize,
}

#[tauri::command]
pub fn get_session_diagnostic_log(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<SessionDiagnosticLog, CommandError> {
    let session_id = match state.diagnostic_session_id.lock() {
        Ok(guard) => guard.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    };

    let log_dir = app.path().app_log_dir().map_err(CommandError::Tauri)?;
    let read = read_session_log_tail(&log_dir, &session_id);

    Ok(SessionDiagnosticLog {
        text: read.text,
        truncated: read.truncated,
        max_bytes: SESSION_LOG_READ_MAX_BYTES,
    })
}
