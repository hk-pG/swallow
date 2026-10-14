mod commands;
mod import;
pub mod item;
mod library;
mod protocol;
mod settings;
mod thumbnail;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol(protocol::THUMBNAIL_SCHEME, protocol::thumbnail)
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::create_library,
            commands::open_library,
            commands::restore_library,
            commands::recent_libraries,
            commands::import_assets,
            commands::list_items,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
