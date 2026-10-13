mod commands;
mod item;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::get_item,
            commands::update_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
