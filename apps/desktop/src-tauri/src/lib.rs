mod commands;
#[expect(
    dead_code,
    reason = "exposed as commands once library open (#3) and item import (#4) land"
)]
mod folders;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
