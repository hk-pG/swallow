//! Minimal path masking for diagnostic logs (full policy in #183; expand in PR ③ if needed).

/// Masks a filesystem path for logs: user home segments become `~`, library roots are basename-only.
pub fn mask_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Some(stripped) = strip_home_prefix(trimmed) {
        return format!("~{stripped}");
    }

    // Fallback: last two path components only (avoids leaking full library root).
    let normalized = trimmed.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() <= 2 {
        return normalized;
    }
    format!("…/{}", parts[parts.len() - 2..].join("/"))
}

fn strip_home_prefix(path: &str) -> Option<String> {
    for home in [std::env::var_os("HOME"), std::env::var_os("USERPROFILE")]
        .into_iter()
        .flatten()
    {
        let home = home.to_string_lossy();
        let home = home.trim_end_matches('/').trim_end_matches('\\');
        let prefix = format!("{home}/");
        let alt = format!("{home}\\");
        if let Some(rest) = path
            .strip_prefix(&prefix)
            .or_else(|| path.strip_prefix(&alt))
        {
            return Some(format!("/{rest}"));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::mask_path;

    #[test]
    fn empty_path() {
        assert_eq!(mask_path(""), "");
    }

    #[test]
    fn truncates_long_paths_without_home() {
        let masked = mask_path("/var/lib/swallow/library/images/abc123/original.mp4");
        assert_eq!(masked, "…/abc123/original.mp4");
    }

    #[test]
    fn masks_home_prefix_when_home_set() {
        let Ok(home) = std::env::var("HOME") else {
            return;
        };
        let full = format!("{home}/Library/Logs/session.log");
        assert_eq!(mask_path(&full), "~/Library/Logs/session.log");
    }
}
