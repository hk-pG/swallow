mod commands;
#[expect(dead_code, reason = "not yet exposed as commands (#7)")]
mod folders;
mod import;
pub mod item;
mod library;
mod protocol;
mod settings;
mod tags;
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
            commands::get_item,
            commands::update_item,
            commands::get_library_tags,
            commands::add_tag,
            commands::remove_tag,
            commands::create_tag_group,
            commands::delete_tag_group,
            commands::set_tag_group,
            commands::add_item_tags,
            commands::remove_item_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
