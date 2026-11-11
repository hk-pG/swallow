pub mod app;
mod error;
pub mod folders;
pub mod import;
pub mod items;
pub mod library;
pub mod settings;
pub mod smart_folders;
pub mod tags;

/// Tauri command handlers in one place; registered names are unchanged.
#[macro_export]
macro_rules! swallow_invoke_handler {
    () => {
        tauri::generate_handler![
            $crate::commands::app::app_info,
            $crate::commands::library::create_library,
            $crate::commands::library::open_library,
            $crate::commands::library::restore_library,
            $crate::commands::library::recent_libraries,
            $crate::commands::settings::get_settings,
            $crate::commands::settings::update_settings,
            $crate::commands::import::import_assets,
            $crate::commands::items::list_items,
            $crate::commands::items::get_item,
            $crate::commands::items::update_item,
            $crate::commands::items::update_items,
            $crate::commands::items::trash_items,
            $crate::commands::items::restore_items,
            $crate::commands::items::purge_items,
            $crate::commands::items::reveal_item_in_explorer,
            $crate::commands::tags::get_library_tags,
            $crate::commands::tags::add_tag,
            $crate::commands::tags::remove_tag,
            $crate::commands::tags::create_tag_group,
            $crate::commands::tags::delete_tag_group,
            $crate::commands::tags::set_tag_group,
            $crate::commands::tags::add_item_tags,
            $crate::commands::tags::remove_item_tags,
            $crate::commands::folders::list_folders,
            $crate::commands::folders::create_folder,
            $crate::commands::folders::rename_folder,
            $crate::commands::folders::move_folder,
            $crate::commands::folders::delete_folder,
            $crate::commands::folders::assign_items,
            $crate::commands::folders::unassign_items,
            $crate::commands::smart_folders::list_smart_folders,
            $crate::commands::smart_folders::create_smart_folder,
            $crate::commands::smart_folders::rename_smart_folder,
            $crate::commands::smart_folders::update_smart_folder,
            $crate::commands::smart_folders::delete_smart_folder,
        ]
    };
}
