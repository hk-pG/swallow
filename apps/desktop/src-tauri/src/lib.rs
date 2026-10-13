mod commands;
mod tags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
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
