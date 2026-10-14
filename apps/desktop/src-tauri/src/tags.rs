use std::fs;
use std::io;
use std::path::Path;

use crate::item::{self, ItemError};
use crate::library::{LibraryTags, TAGS_FILE, TagGroup, write_json_atomic};

#[derive(Debug, thiserror::Error)]
pub enum TagError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("name must not be empty")]
    EmptyName,
    #[error("tag group not found: {0}")]
    GroupNotFound(String),
    #[error(transparent)]
    Item(#[from] ItemError),
}

type Result<T> = std::result::Result<T, TagError>;

fn normalize_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(TagError::EmptyName);
    }
    Ok(name.to_owned())
}

fn normalize_names(names: &[String]) -> Result<Vec<String>> {
    let mut out: Vec<String> = Vec::with_capacity(names.len());
    for name in names {
        let name = normalize_name(name)?;
        if !out.contains(&name) {
            out.push(name);
        }
    }
    Ok(out)
}

impl LibraryTags {
    /// Returns `false` if the tag already exists.
    pub fn add_tag(&mut self, tag: &str) -> bool {
        if self.tags.iter().any(|t| t == tag) {
            return false;
        }
        self.tags.push(tag.to_owned());
        true
    }

    pub fn remove_tag(&mut self, tag: &str) {
        self.tags.retain(|t| t != tag);
        for group in &mut self.groups {
            group.tags.retain(|t| t != tag);
        }
    }

    pub fn create_group(&mut self, name: String) -> &TagGroup {
        self.groups.push(TagGroup {
            id: ulid::Ulid::generate().to_string(),
            name,
            tags: Vec::new(),
        });
        self.groups.last().expect("just pushed")
    }

    pub fn delete_group(&mut self, group_id: &str) -> Result<()> {
        let before = self.groups.len();
        self.groups.retain(|g| g.id != group_id);
        if self.groups.len() == before {
            return Err(TagError::GroupNotFound(group_id.to_owned()));
        }
        Ok(())
    }

    /// A tag belongs to at most one group. `None` makes the tag ungrouped.
    pub fn set_tag_group(&mut self, tag: &str, group_id: Option<&str>) -> Result<()> {
        let target = match group_id {
            Some(id) => Some(
                self.groups
                    .iter()
                    .position(|g| g.id == id)
                    .ok_or_else(|| TagError::GroupNotFound(id.to_owned()))?,
            ),
            None => None,
        };
        self.add_tag(tag);
        for group in &mut self.groups {
            group.tags.retain(|t| t != tag);
        }
        if let Some(index) = target {
            self.groups[index].tags.push(tag.to_owned());
        }
        Ok(())
    }
}

pub fn load(root: &Path) -> Result<LibraryTags> {
    match fs::read(root.join(TAGS_FILE)) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(LibraryTags::default()),
        Err(e) => Err(e.into()),
    }
}

fn save(root: &Path, tags: &LibraryTags) -> Result<()> {
    Ok(write_json_atomic(&root.join(TAGS_FILE), tags)?)
}

fn update(root: &Path, f: impl FnOnce(&mut LibraryTags) -> Result<()>) -> Result<LibraryTags> {
    let mut tags = load(root)?;
    f(&mut tags)?;
    save(root, &tags)?;
    Ok(tags)
}

pub fn add_tag(root: &Path, tag: &str) -> Result<LibraryTags> {
    let tag = normalize_name(tag)?;
    update(root, |tags| {
        tags.add_tag(&tag);
        Ok(())
    })
}

/// Also strips the tag from every item so no item keeps an unlisted tag.
pub fn remove_tag(root: &Path, tag: &str) -> Result<LibraryTags> {
    let tag = normalize_name(tag)?;
    item::edit_all_items(root, |item| item.tags.retain(|t| *t != tag))?;
    update(root, |tags| {
        tags.remove_tag(&tag);
        Ok(())
    })
}

pub fn create_tag_group(root: &Path, name: &str) -> Result<LibraryTags> {
    let name = normalize_name(name)?;
    update(root, |tags| {
        tags.create_group(name);
        Ok(())
    })
}

pub fn delete_tag_group(root: &Path, group_id: &str) -> Result<LibraryTags> {
    update(root, |tags| tags.delete_group(group_id))
}

pub fn set_tag_group(root: &Path, tag: &str, group_id: Option<&str>) -> Result<LibraryTags> {
    let tag = normalize_name(tag)?;
    update(root, |tags| tags.set_tag_group(&tag, group_id))
}

/// Tags not yet in `tags.json` are registered there as well.
pub fn add_item_tags(root: &Path, item_ids: &[String], tags: &[String]) -> Result<LibraryTags> {
    let tags = normalize_names(tags)?;
    item::edit_items(root, item_ids, |item| {
        for tag in &tags {
            if !item.tags.contains(tag) {
                item.tags.push(tag.clone());
            }
        }
    })?;
    update(root, |library| {
        for tag in &tags {
            library.add_tag(tag);
        }
        Ok(())
    })
}

pub fn remove_item_tags(root: &Path, item_ids: &[String], tags: &[String]) -> Result<()> {
    let tags = normalize_names(tags)?;
    item::edit_items(root, item_ids, |item| {
        item.tags.retain(|t| !tags.contains(t));
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::ItemMetadata;
    use crate::item::tests::{sample_item, write_item};
    use crate::library::IMAGES_DIR;
    use std::path::PathBuf;

    struct TempLibrary(PathBuf);

    impl TempLibrary {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("swallow-tags-{}", ulid::Ulid::generate()));
            fs::create_dir_all(path.join(IMAGES_DIR)).unwrap();
            Self(path)
        }

        fn add_item(&self, id: &str, tags: &[&str]) {
            let item = ItemMetadata {
                tags: strings(tags),
                star: 3,
                ..sample_item(id, "sample", "png")
            };
            write_item(&self.0, &item);
        }

        fn item(&self, id: &str) -> ItemMetadata {
            item::load_item(&self.0, id).unwrap()
        }

        fn item_tags(&self, id: &str) -> Vec<String> {
            self.item(id).tags
        }
    }

    impl Drop for TempLibrary {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn missing_tags_file_loads_as_empty() {
        let lib = TempLibrary::new();
        assert_eq!(load(&lib.0).unwrap(), LibraryTags::default());
    }

    #[test]
    fn serializes_with_shared_field_names() {
        let tags = LibraryTags {
            tags: strings(&["cat"]),
            groups: vec![TagGroup {
                id: "g1".into(),
                name: "Animals".into(),
                tags: strings(&["cat"]),
            }],
        };
        assert_eq!(
            serde_json::to_value(&tags).unwrap(),
            serde_json::json!({ "tags": ["cat"], "groups": [{ "id": "g1", "name": "Animals", "tags": ["cat"] }] })
        );
    }

    #[test]
    fn add_tag_trims_dedupes_and_persists() {
        let lib = TempLibrary::new();
        add_tag(&lib.0, " cat ").unwrap();
        add_tag(&lib.0, "cat").unwrap();
        add_tag(&lib.0, "dog").unwrap();
        assert_eq!(load(&lib.0).unwrap().tags, strings(&["cat", "dog"]));
    }

    #[test]
    fn add_tag_rejects_blank_name() {
        let lib = TempLibrary::new();
        assert!(matches!(add_tag(&lib.0, "  "), Err(TagError::EmptyName)));
    }

    #[test]
    fn remove_tag_strips_it_from_groups_and_items() {
        let lib = TempLibrary::new();
        lib.add_item("A", &["cat", "dog"]);
        lib.add_item("B", &["dog"]);
        let group_id = create_tag_group(&lib.0, "Animals").unwrap().groups[0]
            .id
            .clone();
        set_tag_group(&lib.0, "cat", Some(&group_id)).unwrap();

        let tags = remove_tag(&lib.0, "cat").unwrap();

        assert!(tags.tags.is_empty());
        assert!(tags.groups[0].tags.is_empty());
        assert_eq!(lib.item_tags("A"), ["dog"]);
        assert_eq!(lib.item_tags("B"), ["dog"]);
    }

    #[test]
    fn tag_moves_between_groups_and_can_be_ungrouped() {
        let lib = TempLibrary::new();
        create_tag_group(&lib.0, "Animals").unwrap();
        let tags = create_tag_group(&lib.0, "Pets").unwrap();
        let (animals, pets) = (tags.groups[0].id.clone(), tags.groups[1].id.clone());

        set_tag_group(&lib.0, "cat", Some(&animals)).unwrap();
        let tags = set_tag_group(&lib.0, "cat", Some(&pets)).unwrap();
        assert_eq!(tags.tags, strings(&["cat"]));
        assert!(tags.groups[0].tags.is_empty());
        assert_eq!(tags.groups[1].tags, strings(&["cat"]));

        let tags = set_tag_group(&lib.0, "cat", None).unwrap();
        assert!(tags.groups.iter().all(|g| g.tags.is_empty()));
        assert_eq!(tags.tags, strings(&["cat"]));
    }

    #[test]
    fn set_tag_group_rejects_unknown_group() {
        let lib = TempLibrary::new();
        assert!(matches!(
            set_tag_group(&lib.0, "cat", Some("missing")),
            Err(TagError::GroupNotFound(_))
        ));
        assert!(load(&lib.0).unwrap().tags.is_empty());
    }

    #[test]
    fn delete_group_keeps_its_tags() {
        let lib = TempLibrary::new();
        let group_id = create_tag_group(&lib.0, "Animals").unwrap().groups[0]
            .id
            .clone();
        set_tag_group(&lib.0, "cat", Some(&group_id)).unwrap();

        let tags = delete_tag_group(&lib.0, &group_id).unwrap();
        assert!(tags.groups.is_empty());
        assert_eq!(tags.tags, strings(&["cat"]));
        assert!(matches!(
            delete_tag_group(&lib.0, &group_id),
            Err(TagError::GroupNotFound(_))
        ));
    }

    #[test]
    fn add_item_tags_to_multiple_items_registers_tags() {
        let lib = TempLibrary::new();
        lib.add_item("A", &["cat"]);
        lib.add_item("B", &[]);

        let tags = add_item_tags(
            &lib.0,
            &strings(&["A", "B"]),
            &strings(&["cat", "red", "red"]),
        )
        .unwrap();

        assert_eq!(lib.item_tags("A"), ["cat", "red"]);
        assert_eq!(lib.item_tags("B"), ["cat", "red"]);
        assert_eq!(tags.tags, strings(&["cat", "red"]));
        assert_eq!(lib.item("A").star, 3);
    }

    #[test]
    fn remove_item_tags_from_multiple_items() {
        let lib = TempLibrary::new();
        lib.add_item("A", &["cat", "red"]);
        lib.add_item("B", &["red", "dog"]);

        remove_item_tags(&lib.0, &strings(&["A", "B"]), &strings(&["red", "cat"])).unwrap();

        assert!(lib.item_tags("A").is_empty());
        assert_eq!(lib.item_tags("B"), ["dog"]);
    }

    #[test]
    fn unknown_item_leaves_all_items_untouched() {
        let lib = TempLibrary::new();
        lib.add_item("A", &[]);

        let result = add_item_tags(&lib.0, &strings(&["A", "MISSING"]), &strings(&["cat"]));

        assert!(matches!(
            result,
            Err(TagError::Item(ItemError::NotFound(_)))
        ));
        assert!(lib.item_tags("A").is_empty());
        assert!(load(&lib.0).unwrap().tags.is_empty());
    }

    #[test]
    fn rejects_path_traversal_in_item_id() {
        let lib = TempLibrary::new();
        assert!(matches!(
            add_item_tags(&lib.0, &strings(&["../x"]), &strings(&["cat"])),
            Err(TagError::Item(ItemError::InvalidId(_)))
        ));
    }
}
