use crate::app::state::AppState;
use crate::infra::{http_api, protocol};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol(protocol::THUMBNAIL_SCHEME, protocol::thumbnail)
        .manage(AppState::default())
        .setup(|app| {
            http_api::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(crate::swallow_invoke_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
