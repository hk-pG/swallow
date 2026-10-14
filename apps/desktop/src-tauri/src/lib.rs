mod commands;
mod import;
mod item;
mod library;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::create_library,
            commands::open_library,
            commands::restore_library,
            commands::recent_libraries,
            commands::import_assets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
