//! Diagnostic logging facade (`log` crate + `tauri-plugin-log` wired in `app::run` only).

pub mod config;
mod init;
mod privacy;
mod record;
mod rotation;

pub use init::{build_log_plugin, prune_previous_session_logs};
pub use privacy::mask_path;
pub use record::log_event;
