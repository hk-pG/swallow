//! Read tail of the current launch session log for in-app diagnostics (#183 PR②).

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use super::rotation::session_log_file_name;

/// Maximum bytes returned from the session log file (tail only). Documented in PR #183 PR②.
pub const SESSION_LOG_READ_MAX_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionLogRead {
    pub text: String,
    pub truncated: bool,
}

/// Reads the tail of the log file for `session_id` under `log_dir`. Missing or unreadable file → empty text.
pub fn read_session_log_tail(log_dir: &Path, session_id: &str) -> SessionLogRead {
    let path = log_dir.join(session_log_file_name(session_id));
    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return SessionLogRead {
                text: String::new(),
                truncated: false,
            };
        }
        Err(_) => {
            return SessionLogRead {
                text: String::new(),
                truncated: false,
            };
        }
    };

    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    if len == 0 {
        return SessionLogRead {
            text: String::new(),
            truncated: false,
        };
    }

    let truncated = len > SESSION_LOG_READ_MAX_BYTES as u64;
    let start = len.saturating_sub(SESSION_LOG_READ_MAX_BYTES as u64);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return SessionLogRead {
            text: String::new(),
            truncated: false,
        };
    }

    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).is_err() {
        return SessionLogRead {
            text: String::new(),
            truncated: false,
        };
    }

    let mut text = String::from_utf8_lossy(&buf).into_owned();
    if truncated {
        text = trim_to_char_boundary_start(&text);
        if !text.is_empty() {
            text = format!("…{text}");
        }
    }

    SessionLogRead { text, truncated }
}

fn trim_to_char_boundary_start(s: &str) -> String {
    if s.is_char_boundary(0) {
        return s.to_owned();
    }
    let mut start = 1;
    while start < s.len() && !s.is_char_boundary(start) {
        start += 1;
    }
    s[start..].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn missing_file_returns_empty() {
        let dir = tempfile::tempdir().expect("tempdir");
        let out = read_session_log_tail(dir.path(), "01TEST");
        assert_eq!(
            out,
            SessionLogRead {
                text: String::new(),
                truncated: false,
            }
        );
    }

    #[test]
    fn small_file_returned_whole() {
        let dir = tempfile::tempdir().expect("tempdir");
        let name = session_log_file_name("01SMALL");
        let path = dir.path().join(&name);
        std::fs::write(&path, b"hello session").expect("write");
        let out = read_session_log_tail(dir.path(), "01SMALL");
        assert_eq!(out.text, "hello session");
        assert!(!out.truncated);
    }

    #[test]
    fn large_file_returns_tail_with_marker() {
        let dir = tempfile::tempdir().expect("tempdir");
        let name = session_log_file_name("01BIG");
        let path = dir.path().join(&name);
        let mut file = File::create(&path).expect("create");
        let chunk = "x".repeat(1024);
        let repeats = (SESSION_LOG_READ_MAX_BYTES / 1024) + 50;
        for _ in 0..repeats {
            file.write_all(chunk.as_bytes()).expect("write");
        }
        file.write_all(b"TAIL_MARKER").expect("tail");
        drop(file);

        let out = read_session_log_tail(dir.path(), "01BIG");
        assert!(out.truncated);
        assert!(out.text.contains("TAIL_MARKER"));
        assert!(out.text.starts_with('…'));
        assert!(out.text.len() <= SESSION_LOG_READ_MAX_BYTES + 16);
    }
}
