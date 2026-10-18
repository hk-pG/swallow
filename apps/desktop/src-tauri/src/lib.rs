mod commands;
mod folders;
mod http_api;
mod import;
pub mod item;
mod library;
mod protocol;
mod reveal;
mod settings;
mod smart_folders;
mod tags;
mod thumbnail;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol(protocol::THUMBNAIL_SCHEME, protocol::thumbnail)
        .manage(commands::AppState::default())
        .setup(|app| {
            http_api::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::create_library,
            commands::open_library,
            commands::restore_library,
            commands::recent_libraries,
            commands::get_settings,
            commands::update_settings,
            commands::import_assets,
            commands::list_items,
            commands::get_item,
            commands::update_item,
            commands::trash_items,
            commands::restore_items,
            commands::purge_items,
            commands::reveal_item_in_explorer,
            commands::get_library_tags,
            commands::add_tag,
            commands::remove_tag,
            commands::create_tag_group,
            commands::delete_tag_group,
            commands::set_tag_group,
            commands::add_item_tags,
            commands::remove_item_tags,
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::move_folder,
            commands::delete_folder,
            commands::assign_items,
            commands::unassign_items,
            commands::list_smart_folders,
            commands::create_smart_folder,
            commands::rename_smart_folder,
            commands::update_smart_folder,
            commands::delete_smart_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
