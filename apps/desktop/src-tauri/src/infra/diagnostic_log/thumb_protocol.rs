//! Structured logging helpers for the `thumb://` custom protocol (#183 PR③).

use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};

use crate::domain::diagnostic_text::{mask_home_in_diagnostic_text, truncate_diagnostic_message};
use log::Level;
use percent_encoding::percent_decode_str;
use serde_json::{Map, Value, json};
use std::path::Path;

use super::privacy::mask_path;
use super::record::log_event;

const SOURCE: &str = "thumb-protocol";
const COMPONENT: &str = "infra::protocol";

/// Max distinct `(itemId, full)` keys for one-time Range debug logs per process session.
const MAX_RANGE_LOG_KEYS: usize = 256;

static RANGE_REQUEST_LOGGED: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

pub fn item_id_from_item_dir(item_dir: &Path) -> Option<String> {
    let name = item_dir.file_name()?.to_str()?;
    name.strip_suffix(".info").map(str::to_string)
}

fn range_log_key(encoded_path: &str, full: bool) -> String {
    if let Ok(decoded) = percent_decode_str(encoded_path).decode_utf8() {
        let path = Path::new(decoded.as_ref());
        let id = item_id_from_item_dir(path).unwrap_or_else(|| "unknown".into());
        return format!("{id}:{full}");
    }
    format!("raw:{encoded_path}:{full}")
}

/// Logs at most once per item (and `full` flag) per app session to limit WKWebView Range noise.
pub fn log_thumb_range_request_once(encoded_path: &str, full: bool) -> bool {
    let key = range_log_key(encoded_path, full);
    let Ok(mut set) = RANGE_REQUEST_LOGGED.lock() else {
        return false;
    };
    if set.contains(&key) {
        return false;
    }
    if set.len() >= MAX_RANGE_LOG_KEYS {
        set.clear();
    }
    set.insert(key);
    log_thumb_range_request(encoded_path, full);
    true
}

#[cfg(test)]
pub(crate) fn reset_range_request_log_for_tests() {
    if let Ok(mut set) = RANGE_REQUEST_LOGGED.lock() {
        set.clear();
    }
}

fn diagnostic_error_field(raw: &str) -> String {
    truncate_diagnostic_message(&mask_home_in_diagnostic_text(raw))
}

pub fn thumb_fields_base(full: bool, range_requested: bool) -> Map<String, Value> {
    let mut fields = Map::new();
    fields.insert("source".into(), json!(SOURCE));
    fields.insert("component".into(), json!(COMPONENT));
    fields.insert("urlScheme".into(), json!("thumb"));
    fields.insert("full".into(), json!(full));
    if range_requested {
        fields.insert("rangeRequested".into(), json!(true));
    }
    fields
}

pub fn thumb_fields_for_encoded(
    encoded_path: &str,
    full: bool,
    range_requested: bool,
) -> Map<String, Value> {
    let mut fields = thumb_fields_base(full, range_requested);
    if let Ok(decoded) = percent_decode_str(encoded_path).decode_utf8() {
        let path = Path::new(decoded.as_ref());
        if let Some(id) = item_id_from_item_dir(path) {
            fields.insert("itemId".into(), json!(id));
        }
        fields.insert("itemDirMasked".into(), json!(mask_path(&decoded)));
    }
    fields
}

fn log_thumb_range_request(encoded_path: &str, full: bool) {
    let fields = thumb_fields_for_encoded(encoded_path, full, true);
    log_event(Level::Debug, "thumb range request (unsupported)", &fields);
}

pub fn log_thumb_bad_request(reason: &str, encoded_path: &str, full: bool) {
    let mut fields = thumb_fields_for_encoded(encoded_path, full, false);
    fields.insert("errorCode".into(), json!("bad_request"));
    fields.insert("errorMessage".into(), json!(diagnostic_error_field(reason)));
    log_event(Level::Warn, "thumb request failed", &fields);
}

pub fn log_thumb_forbidden(encoded_path: &str, full: bool, reason: &str) {
    let mut fields = thumb_fields_for_encoded(encoded_path, full, false);
    fields.insert("errorCode".into(), json!("forbidden"));
    fields.insert("errorMessage".into(), json!(diagnostic_error_field(reason)));
    log_event(Level::Warn, "thumb request failed", &fields);
}

pub fn log_thumb_not_found(encoded_path: &str, full: bool) {
    let mut fields = thumb_fields_for_encoded(encoded_path, full, false);
    fields.insert("errorCode".into(), json!("not_found"));
    log_event(Level::Info, "thumb preview asset missing", &fields);
}

pub fn log_thumb_preview_error(encoded_path: &str, full: bool, error_message: String) {
    let mut fields = thumb_fields_for_encoded(encoded_path, full, false);
    fields.insert("errorCode".into(), json!("preview_error"));
    fields.insert(
        "errorMessage".into(),
        json!(diagnostic_error_field(&error_message)),
    );
    log_event(Level::Error, "thumb preview generation failed", &fields);
}

pub fn log_thumb_read_error(encoded_path: &str, full: bool, error_message: String) {
    let mut fields = thumb_fields_for_encoded(encoded_path, full, false);
    fields.insert("errorCode".into(), json!("read_error"));
    fields.insert(
        "errorMessage".into(),
        json!(diagnostic_error_field(&error_message)),
    );
    log_event(Level::Warn, "thumb asset read failed", &fields);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_id_from_info_dir() {
        let dir = Path::new("/lib/images/01ITEMID.info");
        assert_eq!(item_id_from_item_dir(dir).as_deref(), Some("01ITEMID"));
    }

    #[test]
    fn thumb_fields_include_item_id_without_full_path() {
        let encoded = percent_encoding::utf8_percent_encode(
            "/Users/lib/images/01X.info",
            percent_encoding::NON_ALPHANUMERIC,
        )
        .to_string();
        let fields = thumb_fields_for_encoded(&encoded, true, false);
        assert_eq!(fields.get("itemId").and_then(|v| v.as_str()), Some("01X"));
        assert!(fields.get("itemDirMasked").is_some());
        assert_eq!(
            fields.get("urlScheme").and_then(|v| v.as_str()),
            Some("thumb")
        );
    }

    #[test]
    fn range_request_logged_at_most_once_per_item_and_full_flag() {
        reset_range_request_log_for_tests();
        let encoded = percent_encoding::utf8_percent_encode(
            "/lib/images/01RANGE.info",
            percent_encoding::NON_ALPHANUMERIC,
        )
        .to_string();
        assert!(log_thumb_range_request_once(&encoded, true));
        assert!(!log_thumb_range_request_once(&encoded, true));
        assert!(log_thumb_range_request_once(&encoded, false));
        reset_range_request_log_for_tests();
    }

    #[test]
    fn logging_helpers_do_not_panic() {
        log_thumb_range_request_once("bad%", false);
        log_thumb_bad_request("invalid utf-8", "bad%", false);
        log_thumb_forbidden("x", true, "not item dir");
        log_thumb_not_found("x", false);
        log_thumb_preview_error("x", true, "decode failed".into());
        log_thumb_read_error("x", false, "io error".into());
        reset_range_request_log_for_tests();
    }
}
