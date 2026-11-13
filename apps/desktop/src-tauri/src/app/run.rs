use tauri::Manager;

use crate::app::state::AppState;
use crate::infra::{diagnostic_log, http_api, protocol};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_id = ulid::Ulid::generate().to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(diagnostic_log::build_log_plugin::<tauri::Wry>(&session_id))
        .register_asynchronous_uri_scheme_protocol(protocol::THUMBNAIL_SCHEME, protocol::thumbnail)
        .manage(AppState::new(session_id.clone()))
        .setup(move |app| {
            if let Ok(log_dir) = app.path().app_log_dir() {
                let _ = diagnostic_log::prune_previous_session_logs(&log_dir);
                let mut fields = serde_json::Map::new();
                fields.insert(
                    "logDirMasked".into(),
                    serde_json::Value::String(diagnostic_log::mask_path(
                        &log_dir.display().to_string(),
                    )),
                );
                fields.insert(
                    "sessionId".into(),
                    serde_json::Value::String(session_id.clone()),
                );
                diagnostic_log::log_event(log::Level::Info, "diagnostic session started", &fields);
            }
            http_api::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(crate::swallow_invoke_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
