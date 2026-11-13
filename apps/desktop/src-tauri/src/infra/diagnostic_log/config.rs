//! Constants for diagnostic session log files (see issue #183).

/// Filename prefix for per-launch session logs under the OS log directory.
pub const SESSION_LOG_FILE_PREFIX: &str = "swallow-session-";

/// Maximum number of session log files to retain (including the active session).
pub const MAX_RETAINED_SESSION_LOGS: usize = 10;

/// Default maximum level for the global filter (module overrides via `level_for`).
pub use log::LevelFilter;

/// Initial global maximum log level.
pub const DEFAULT_MAX_LEVEL: LevelFilter = LevelFilter::Debug;

/// Default level for noisy HTTP stacks.
pub const HYPER_MODULE_LEVEL: LevelFilter = LevelFilter::Warn;

/// Log target used by Swallow structured diagnostics (preview failures etc. in later PRs).
pub const SWALLOW_DIAG_TARGET: &str = "swallow::diagnostic";
