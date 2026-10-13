mod commands;
pub mod library;
mod protocol;
pub mod thumbnail;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol(protocol::THUMBNAIL_SCHEME, protocol::thumbnail)
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::list_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
