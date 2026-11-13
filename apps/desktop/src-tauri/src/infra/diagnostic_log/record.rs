use log::Level;
use serde_json::{Map, Value};

use super::config::SWALLOW_DIAG_TARGET;

/// Appends structured fields as a single JSON object suffix (one line per log record).
pub fn format_fields_json(fields: &Map<String, Value>) -> String {
    if fields.is_empty() {
        return String::new();
    }
    serde_json::to_string(fields).unwrap_or_default()
}

/// Logs a message with structured fields via the `log` crate (implementation-agnostic).
pub fn log_event(level: Level, message: &str, fields: &Map<String, Value>) {
    let suffix = format_fields_json(fields);
    let formatted = if suffix.is_empty() {
        message.to_string()
    } else {
        format!("{message} {suffix}")
    };
    match level {
        Level::Error => log::error!(target: SWALLOW_DIAG_TARGET, "{formatted}"),
        Level::Warn => log::warn!(target: SWALLOW_DIAG_TARGET, "{formatted}"),
        Level::Info => log::info!(target: SWALLOW_DIAG_TARGET, "{formatted}"),
        Level::Debug => log::debug!(target: SWALLOW_DIAG_TARGET, "{formatted}"),
        Level::Trace => log::trace!(target: SWALLOW_DIAG_TARGET, "{formatted}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_empty_fields() {
        assert_eq!(format_fields_json(&Map::new()), "");
    }

    #[test]
    fn log_event_does_not_panic() {
        let mut fields = Map::new();
        fields.insert("itemId".into(), json!("abc"));
        log_event(Level::Info, "test", &fields);
    }
}
