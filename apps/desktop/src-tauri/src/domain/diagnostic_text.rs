//! Shared diagnostic text limits (domain + infra; avoids infra import from domain).

/// Max length for `errorMessage` and similar free-text diagnostic fields (#183).
pub const DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN: usize = 512;

const TRUNCATION_ELLIPSIS: &str = "…";

pub fn truncate_diagnostic_message(text: &str) -> String {
    let char_count = text.chars().count();
    if char_count <= DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN {
        return text.to_string();
    }
    let ellipsis_len = TRUNCATION_ELLIPSIS.chars().count();
    let take = DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN.saturating_sub(ellipsis_len);
    let mut out: String = text.chars().take(take).collect();
    out.push_str(TRUNCATION_ELLIPSIS);
    out
}

/// Replaces `HOME` / `USERPROFILE` prefixes embedded in OS error strings.
pub fn mask_home_in_diagnostic_text(text: &str) -> String {
    let mut out = text.to_string();
    for home in [std::env::var_os("HOME"), std::env::var_os("USERPROFILE")]
        .into_iter()
        .flatten()
    {
        let home = home.to_string_lossy();
        let trimmed = home.trim_end_matches('/').trim_end_matches('\\');
        if trimmed.is_empty() {
            continue;
        }
        out = out.replace(trimmed, "~");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_leaves_short_text_unchanged() {
        assert_eq!(truncate_diagnostic_message("ok"), "ok");
    }

    #[test]
    fn truncate_appends_ellipsis_when_over_limit() {
        let long = "x".repeat(DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN + 10);
        let out = truncate_diagnostic_message(&long);
        assert_eq!(out.chars().count(), DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN);
        assert!(out.ends_with(TRUNCATION_ELLIPSIS));
    }

    #[test]
    fn mask_home_in_text() {
        let Ok(home) = std::env::var("HOME") else {
            return;
        };
        let raw = format!("failed to open {home}/secret/file");
        assert_eq!(
            mask_home_in_diagnostic_text(&raw),
            "failed to open ~/secret/file"
        );
    }
}
