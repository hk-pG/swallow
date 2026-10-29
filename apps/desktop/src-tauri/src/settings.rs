use std::collections::BTreeMap;
use std::fs;
use std::io;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SETTINGS_FILE: &str = "settings.json";

/// Mirrors `SETTINGS_VERSION` in `packages/shared/src/settings.ts`.
pub const SETTINGS_VERSION: u32 = 1;

const MAX_RECENT_LIBRARIES: usize = 10;

/// Mirrors `ItemViewMode` in `packages/shared/src/itemView.ts`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ItemViewMode {
    Grid,
    List,
}

/// Mirrors `AppearanceSettings` in `packages/shared/src/settings.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearanceSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_view_mode: Option<ItemViewMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_size_index: Option<i32>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Partial `appearance` patch accepted by `update_settings`.
#[derive(Debug, Default, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearanceSettingsPatch {
    pub item_view_mode: Option<ItemViewMode>,
    pub thumbnail_size_index: Option<i32>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Mirrors `ShortcutSettings` in `packages/shared/src/settings.ts` (`Record<string, never>`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ShortcutSettings {
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Mirrors `BehaviorSettings` in `packages/shared/src/settings.ts` (`Record<string, never>`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct BehaviorSettings {
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Mirrors `Settings` in `packages/shared/src/settings.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    /// Most recently opened first.
    pub recent_libraries: Vec<String>,
    pub shortcuts: ShortcutSettings,
    pub appearance: AppearanceSettings,
    pub behavior: BehaviorSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            recent_libraries: Vec::new(),
            shortcuts: ShortcutSettings::default(),
            appearance: AppearanceSettings::default(),
            behavior: BehaviorSettings::default(),
        }
    }
}

/// Mirrors `SettingsPatch` in `packages/shared/src/settings.ts`.
#[derive(Debug, Default, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsPatch {
    pub recent_libraries: Option<Vec<String>>,
    pub shortcuts: Option<ShortcutSettings>,
    pub appearance: Option<AppearanceSettingsPatch>,
    pub behavior: Option<BehaviorSettings>,
}

/// On-disk settings plus keys this binary does not model yet.
#[derive(Debug, Clone)]
pub struct SettingsDocument {
    pub settings: Settings,
    raw: Value,
}

impl SettingsDocument {
    /// A missing or unreadable file yields defaults so startup never blocks.
    pub fn load(path: &std::path::Path) -> Self {
        let raw = fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_else(empty_object);
        let settings = settings_from_value(&raw);
        Self { settings, raw }
    }

    pub fn save(&self, path: &std::path::Path) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let merged = merge_known_into_raw(&self.raw, &self.settings);
        fs::write(path, serde_json::to_vec_pretty(&merged)?)
    }

    pub fn apply_patch(&mut self, patch: SettingsPatch) {
        if let Some(recent_libraries) = patch.recent_libraries {
            self.settings.recent_libraries = recent_libraries;
            self.settings
                .recent_libraries
                .truncate(MAX_RECENT_LIBRARIES);
        }
        if let Some(patch) = patch.shortcuts {
            merge_shortcut_settings(&mut self.settings.shortcuts, patch);
        }
        if let Some(patch) = patch.appearance {
            merge_appearance_settings(&mut self.settings.appearance, patch);
        }
        if let Some(patch) = patch.behavior {
            merge_behavior_settings(&mut self.settings.behavior, patch);
        }
        self.settings.version = SETTINGS_VERSION;
        self.raw = merge_known_into_raw(&self.raw, &self.settings);
    }
}

impl Settings {
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

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn settings_from_value(raw: &Value) -> Settings {
    let parsed: Settings = serde_json::from_value(raw.clone()).unwrap_or_default();
    if parsed.version == 0 {
        Settings {
            version: SETTINGS_VERSION,
            ..parsed
        }
    } else {
        parsed
    }
}

fn merge_known_into_raw(raw: &Value, settings: &Settings) -> Value {
    let known = serde_json::to_value(settings).expect("settings serialize");
    let mut out = match raw {
        Value::Object(map) => Value::Object(map.clone()),
        _ => empty_object(),
    };
    if let (Value::Object(out_map), Value::Object(known_map)) = (&mut out, known) {
        for (key, value) in known_map {
            out_map.insert(key.clone(), value.clone());
        }
    }
    out
}

fn merge_shortcut_settings(base: &mut ShortcutSettings, patch: ShortcutSettings) {
    base.extra.extend(patch.extra);
}

fn merge_behavior_settings(base: &mut BehaviorSettings, patch: BehaviorSettings) {
    base.extra.extend(patch.extra);
}

fn merge_appearance_settings(base: &mut AppearanceSettings, patch: AppearanceSettingsPatch) {
    if let Some(item_view_mode) = patch.item_view_mode {
        base.item_view_mode = Some(item_view_mode);
    }
    if let Some(thumbnail_size_index) = patch.thumbnail_size_index {
        base.thumbnail_size_index = Some(thumbnail_size_index);
    }
    for (key, value) in patch.extra {
        base.extra.insert(key, value);
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

        let doc = SettingsDocument {
            settings,
            raw: empty_object(),
        };
        doc.save(&path).unwrap();

        assert_eq!(SettingsDocument::load(&path).settings, doc.settings);
    }

    #[test]
    fn load_falls_back_to_default_on_corrupt_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(&path, "not json").unwrap();
        assert_eq!(SettingsDocument::load(&path).settings, Settings::default());
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let settings = Settings {
            recent_libraries: vec!["/lib".into()],
            ..Settings::default()
        };
        assert_eq!(
            serde_json::to_value(&settings).unwrap(),
            serde_json::json!({
                "version": SETTINGS_VERSION,
                "recentLibraries": ["/lib"],
                "shortcuts": {},
                "appearance": {},
                "behavior": {}
            })
        );
    }

    #[test]
    fn appearance_serializes_with_shared_camel_case_fields() {
        let appearance = AppearanceSettings {
            item_view_mode: Some(ItemViewMode::List),
            thumbnail_size_index: Some(2),
            ..AppearanceSettings::default()
        };
        assert_eq!(
            serde_json::to_value(&appearance).unwrap(),
            serde_json::json!({
                "itemViewMode": "list",
                "thumbnailSizeIndex": 2
            })
        );
    }

    #[test]
    fn loads_legacy_file_with_only_recent_libraries() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(&path, r#"{"recentLibraries":["/a"]}"#).unwrap();
        let settings = SettingsDocument::load(&path).settings;
        assert_eq!(settings.recent_libraries, ["/a"]);
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert_eq!(settings.shortcuts, ShortcutSettings::default());
        assert_eq!(settings.appearance, AppearanceSettings::default());
    }

    #[test]
    fn save_preserves_unknown_top_level_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(
            &path,
            r#"{"recentLibraries":["/a"],"futureFeature":{"enabled":true}}"#,
        )
        .unwrap();

        let mut doc = SettingsDocument::load(&path);
        doc.settings.push_recent_library("/b");
        doc.save(&path).unwrap();

        let raw: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(raw["futureFeature"], serde_json::json!({ "enabled": true }));
        assert_eq!(doc.settings.last_library(), Some("/b"));
    }

    #[test]
    fn push_recent_via_document_does_not_drop_unknown_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(&path, r#"{"recentLibraries":[],"experimental":42}"#).unwrap();

        let mut doc = SettingsDocument::load(&path);
        doc.settings.push_recent_library("/lib");
        doc.save(&path).unwrap();

        let raw: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(raw["experimental"], 42);
        assert_eq!(raw["recentLibraries"], serde_json::json!(["/lib"]));
    }

    #[test]
    fn apply_patch_merges_section_objects() {
        let mut doc = SettingsDocument {
            settings: Settings::default(),
            raw: empty_object(),
        };
        doc.apply_patch(SettingsPatch {
            appearance: Some(AppearanceSettingsPatch {
                extra: BTreeMap::from([
                    ("theme".into(), serde_json::json!("dark")),
                    ("extra".into(), serde_json::json!(true)),
                ]),
                ..Default::default()
            }),
            ..Default::default()
        });
        assert_eq!(
            doc.settings.appearance.extra.get("theme"),
            Some(&serde_json::json!("dark"))
        );
        assert_eq!(
            doc.settings.appearance.extra.get("extra"),
            Some(&serde_json::json!(true))
        );
    }

    #[test]
    fn apply_patch_replaces_recent_libraries_list() {
        let mut doc = SettingsDocument {
            settings: Settings::default(),
            raw: empty_object(),
        };
        doc.apply_patch(SettingsPatch {
            recent_libraries: Some(vec!["/x".into(), "/y".into()]),
            ..Default::default()
        });
        assert_eq!(doc.settings.recent_libraries, ["/x", "/y"]);
    }

    #[test]
    fn appearance_patch_merges_like_use_appearance_settings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(
            &path,
            r#"{"appearance":{"itemViewMode":"list","thumbnailSizeIndex":3}}"#,
        )
        .unwrap();

        let mut doc = SettingsDocument::load(&path);
        assert_eq!(
            doc.settings.appearance.item_view_mode,
            Some(ItemViewMode::List)
        );
        assert_eq!(doc.settings.appearance.thumbnail_size_index, Some(3));

        doc.apply_patch(SettingsPatch {
            appearance: Some(AppearanceSettingsPatch {
                thumbnail_size_index: Some(1),
                ..Default::default()
            }),
            ..Default::default()
        });
        assert_eq!(
            doc.settings.appearance.item_view_mode,
            Some(ItemViewMode::List)
        );
        assert_eq!(doc.settings.appearance.thumbnail_size_index, Some(1));

        doc.apply_patch(SettingsPatch {
            appearance: Some(AppearanceSettingsPatch {
                item_view_mode: Some(ItemViewMode::Grid),
                ..Default::default()
            }),
            ..Default::default()
        });
        assert_eq!(
            doc.settings.appearance.item_view_mode,
            Some(ItemViewMode::Grid)
        );
        assert_eq!(doc.settings.appearance.thumbnail_size_index, Some(1));

        doc.save(&path).unwrap();
        let reloaded = SettingsDocument::load(&path).settings.appearance;
        assert_eq!(reloaded.item_view_mode, Some(ItemViewMode::Grid));
        assert_eq!(reloaded.thumbnail_size_index, Some(1));
    }
}
