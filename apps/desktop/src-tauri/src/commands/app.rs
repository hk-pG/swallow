pub use crate::domain::app_info::AppInfo;
use crate::infra::app_info::from_app_handle;

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> AppInfo {
    from_app_handle(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_serializes_with_shared_field_names() {
        let info = AppInfo {
            name: "Swallow".into(),
            version: "0.1.0".into(),
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "name": "Swallow", "version": "0.1.0" })
        );
    }
}
