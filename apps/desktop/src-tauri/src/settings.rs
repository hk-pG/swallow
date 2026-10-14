use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub const SETTINGS_FILE: &str = "settings.json";
const MAX_RECENT_LIBRARIES: usize = 10;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Most recently opened first.
    pub recent_libraries: Vec<String>,
}

impl Settings {
    /// A missing or unreadable file yields the defaults so a corrupt file never blocks startup.
    pub fn load(path: &Path) -> Self {
        fs::read(path)
            .ok()
            .and_then(|raw| serde_json::from_slice(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_vec_pretty(self)?)
    }

    pub fn last_library(&self) -> Option<&str> {
        self.recent_libraries.first().map(String::as_str)
    }

    pub fn push_recent_library(&mut self, path: &str) {
        self.remove_recent_library(path);
        self.recent_libraries.insert(0, path.to_owned());
        self.recent_libraries.truncate(MAX_RECENT_LIBRARIES);
    }

    pub fn remove_recent_library(&mut self, path: &str) {
        self.recent_libraries.retain(|p| p != path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_moves_existing_entry_to_front_and_caps_length() {
        let mut settings = Settings::default();
        for i in 0..MAX_RECENT_LIBRARIES + 2 {
            settings.push_recent_library(&format!("lib{i}"));
        }
        settings.push_recent_library("lib5");

        assert_eq!(settings.recent_libraries.len(), MAX_RECENT_LIBRARIES);
        assert_eq!(settings.last_library(), Some("lib5"));
        assert_eq!(
            settings
                .recent_libraries
                .iter()
                .filter(|p| *p == "lib5")
                .count(),
            1
        );
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join(SETTINGS_FILE);
        let mut settings = Settings::default();
        settings.push_recent_library("/a");

        settings.save(&path).unwrap();

        assert_eq!(Settings::load(&path), settings);
    }

    #[test]
    fn load_falls_back_to_default_on_corrupt_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(&path, "not json").unwrap();
        assert_eq!(Settings::load(&path), Settings::default());
    }
}
