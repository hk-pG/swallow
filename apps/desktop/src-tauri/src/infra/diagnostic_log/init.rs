use tauri::Runtime;
use tauri::plugin::TauriPlugin;
use tauri_plugin_log::{Builder, FileOpenStrategy, RotationStrategy, Target, TargetKind};

use super::config::{DEFAULT_MAX_LEVEL, HYPER_MODULE_LEVEL, MAX_RETAINED_SESSION_LOGS};
use super::rotation::{prune_session_logs, session_log_file_name};

/// Builds the `tauri-plugin-log` plugin for a new launch session (`session_id` = ULID).
pub fn build_log_plugin<R: Runtime>(session_id: &str) -> TauriPlugin<R> {
    let file_name = session_log_file_name(session_id);
    Builder::new()
        .level(DEFAULT_MAX_LEVEL)
        .level_for("hyper", HYPER_MODULE_LEVEL)
        .level_for("tao", HYPER_MODULE_LEVEL)
        .file_open_strategy(FileOpenStrategy::Append)
        .rotation_strategy(RotationStrategy::KeepAll)
        .max_file_size(512 * 1024 * 1024)
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir {
                file_name: Some(file_name),
            }),
        ])
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{} {}] {}",
                record.level(),
                record.target(),
                message
            ));
        })
        .build()
}

/// Prunes older session logs under the OS log directory. Safe to call from `setup`.
pub fn prune_previous_session_logs(log_dir: &std::path::Path) -> Result<(), std::io::Error> {
    prune_session_logs(log_dir, MAX_RETAINED_SESSION_LOGS)?;
    Ok(())
}
