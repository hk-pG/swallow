use crate::domain::app_info::AppInfo;

pub fn from_app_handle(app: &tauri::AppHandle) -> AppInfo {
    let pkg = app.package_info();
    AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
    }
}
