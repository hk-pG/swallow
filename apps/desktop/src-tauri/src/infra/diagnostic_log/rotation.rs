use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::config::SESSION_LOG_FILE_PREFIX;

/// Builds the log file name for a launch session (`swallow-session-<id>.log`).
pub fn session_log_file_name(session_id: &str) -> String {
    format!("{SESSION_LOG_FILE_PREFIX}{session_id}.log")
}

/// Returns whether `name` is a managed session log file.
pub fn is_session_log_file_name(name: &str) -> bool {
    name.starts_with(SESSION_LOG_FILE_PREFIX) && name.ends_with(".log")
}

/// Given session log entries `(file_name, modified)`, returns names to delete when over capacity.
pub fn session_logs_to_prune(
    mut entries: Vec<(String, SystemTime)>,
    max_retained: usize,
) -> Vec<String> {
    if max_retained == 0 || entries.len() <= max_retained {
        return Vec::new();
    }
    entries.sort_by_key(|(_, t)| *t);
    let excess = entries.len().saturating_sub(max_retained);
    entries
        .into_iter()
        .take(excess)
        .map(|(name, _)| name)
        .collect()
}

/// Removes oldest session logs in `log_dir`, keeping at most `max_retained` files.
pub fn prune_session_logs(log_dir: &Path, max_retained: usize) -> std::io::Result<Vec<PathBuf>> {
    let read_dir = match fs::read_dir(log_dir) {
        Ok(d) => d,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };

    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if !file_type.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_session_log_file_name(&name) {
            continue;
        }
        let modified = entry
            .metadata()?
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH);
        entries.push((name, modified));
    }

    let to_remove = session_logs_to_prune(entries, max_retained);
    let mut removed = Vec::new();
    for name in to_remove {
        let path = log_dir.join(&name);
        if fs::remove_file(&path).is_ok() {
            removed.push(path);
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn session_log_file_name_format() {
        assert_eq!(
            session_log_file_name("01JCM0TEST"),
            "swallow-session-01JCM0TEST.log"
        );
    }

    #[test]
    fn prune_selection_keeps_newest() {
        let t0 = UNIX_EPOCH;
        let t1 = t0 + Duration::from_secs(1);
        let t2 = t0 + Duration::from_secs(2);
        let entries = vec![
            ("swallow-session-a.log".into(), t0),
            ("swallow-session-b.log".into(), t1),
            ("swallow-session-c.log".into(), t2),
        ];
        let pruned = session_logs_to_prune(entries, 2);
        assert_eq!(pruned, vec!["swallow-session-a.log"]);
    }

    #[test]
    fn prune_on_disk() {
        let dir = tempfile::tempdir().expect("tempdir");
        let old_path = dir.path().join("swallow-session-old.log");
        let new_path = dir.path().join("swallow-session-new.log");
        std::fs::write(&old_path, b"x").expect("write");
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(&new_path, b"x").expect("write");
        std::fs::write(dir.path().join("other.txt"), b"y").expect("write");

        let removed = prune_session_logs(dir.path(), 1).expect("prune");
        assert_eq!(removed.len(), 1);
        assert!(removed[0].ends_with("swallow-session-old.log"));
        assert!(dir.path().join("swallow-session-new.log").exists());
        assert!(dir.path().join("other.txt").exists());
    }
}
