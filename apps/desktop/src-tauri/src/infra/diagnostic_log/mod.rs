//! Diagnostic logging facade (`log` crate + `tauri-plugin-log` wired in `app::run` only).

pub mod config;
mod init;
mod privacy;
mod read;
mod record;
mod rotation;

pub use init::{build_log_plugin, prune_previous_session_logs};
pub use privacy::mask_path;
pub use read::{SESSION_LOG_READ_MAX_BYTES, read_session_log_tail};
pub use record::log_event;
