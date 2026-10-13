use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize, Serializer};
use serde_json::Value;

const TAGS_FILE: &str = "tags.json";
const IMAGES_DIR: &str = "images";
const ITEM_INFO_SUFFIX: &str = ".info";
const ITEM_METADATA_FILE: &str = "metadata.json";

/// Mirrors `TagGroup` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TagGroup {
    pub id: String,
    pub name: String,
    pub tags: Vec<String>,
}

/// Mirrors `LibraryTags` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibraryTags {
    pub tags: Vec<String>,
    pub groups: Vec<TagGroup>,
}

#[derive(Debug)]
pub enum TagError {
    Io(io::Error),
    Json(serde_json::Error),
    EmptyName,
    GroupNotFound(String),
    InvalidItemId(String),
    ItemNotFound(String),
    InvalidItemMetadata(String),
}

impl fmt::Display for TagError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(e) => write!(f, "I/O error: {e}"),
            Self::Json(e) => write!(f, "invalid JSON: {e}"),
            Self::EmptyName => write!(f, "name must not be empty"),
            Self::GroupNotFound(id) => write!(f, "tag group not found: {id}"),
            Self::InvalidItemId(id) => write!(f, "invalid item id: {id}"),
            Self::ItemNotFound(id) => write!(f, "item not found: {id}"),
            Self::InvalidItemMetadata(id) => write!(f, "invalid metadata for item: {id}"),
        }
    }
}

impl std::error::Error for TagError {}

impl From<io::Error> for TagError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

impl From<serde_json::Error> for TagError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}

impl Serialize for TagError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
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

fn write_json_atomic<T: Serialize + ?Sized>(path: &Path, value: &T) -> Result<()> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, serde_json::to_vec_pretty(value)?)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn load(root: &Path) -> Result<LibraryTags> {
    match fs::read(root.join(TAGS_FILE)) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(LibraryTags::default()),
        Err(e) => Err(e.into()),
    }
}

fn save(root: &Path, tags: &LibraryTags) -> Result<()> {
    write_json_atomic(&root.join(TAGS_FILE), tags)
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
    for item_dir in item_dirs(root)? {
        let path = item_dir.join(ITEM_METADATA_FILE);
        let id = item_id_of(&item_dir);
        let mut metadata = read_item_metadata(&path, &id)?;
        let tags = item_tags_mut(&mut metadata, &id)?;
        let before = tags.len();
        tags.retain(|t| t.as_str() != Some(tag.as_str()));
        if tags.len() != before {
            write_json_atomic(&path, &metadata)?;
        }
    }
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
    edit_items(root, item_ids, |item_tags| {
        for tag in &tags {
            if !item_tags.iter().any(|t| t.as_str() == Some(tag)) {
                item_tags.push(Value::String(tag.clone()));
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
    edit_items(root, item_ids, |item_tags| {
        item_tags.retain(|t| !t.as_str().is_some_and(|t| tags.iter().any(|tag| tag == t)));
    })
}

/// Reads every item before writing any, so an unknown id leaves all items untouched.
fn edit_items(root: &Path, item_ids: &[String], edit: impl Fn(&mut Vec<Value>)) -> Result<()> {
    let mut items = Vec::with_capacity(item_ids.len());
    for id in item_ids {
        let path = item_metadata_path(root, id)?;
        if !path.is_file() {
            return Err(TagError::ItemNotFound(id.clone()));
        }
        let metadata = read_item_metadata(&path, id)?;
        items.push((id, path, metadata));
    }
    for (id, path, mut metadata) in items {
        edit(item_tags_mut(&mut metadata, id)?);
        write_json_atomic(&path, &metadata)?;
    }
    Ok(())
}

fn item_metadata_path(root: &Path, id: &str) -> Result<PathBuf> {
    let valid = !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !valid {
        return Err(TagError::InvalidItemId(id.to_owned()));
    }
    Ok(root
        .join(IMAGES_DIR)
        .join(format!("{id}{ITEM_INFO_SUFFIX}"))
        .join(ITEM_METADATA_FILE))
}

fn item_dirs(root: &Path) -> Result<Vec<PathBuf>> {
    let entries = match fs::read_dir(root.join(IMAGES_DIR)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };
    let mut dirs = Vec::new();
    for entry in entries {
        let path = entry?.path();
        let is_item = path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.ends_with(ITEM_INFO_SUFFIX));
        if is_item && path.join(ITEM_METADATA_FILE).is_file() {
            dirs.push(path);
        }
    }
    Ok(dirs)
}

fn item_id_of(item_dir: &Path) -> String {
    item_dir
        .file_name()
        .and_then(|n| n.to_str())
        .and_then(|n| n.strip_suffix(ITEM_INFO_SUFFIX))
        .unwrap_or_default()
        .to_owned()
}

fn read_item_metadata(path: &Path, id: &str) -> Result<Value> {
    let metadata: Value = serde_json::from_slice(&fs::read(path)?)?;
    if !metadata.is_object() {
        return Err(TagError::InvalidItemMetadata(id.to_owned()));
    }
    Ok(metadata)
}

fn item_tags_mut<'a>(metadata: &'a mut Value, id: &str) -> Result<&'a mut Vec<Value>> {
    let object = metadata
        .as_object_mut()
        .ok_or_else(|| TagError::InvalidItemMetadata(id.to_owned()))?;
    object
        .entry("tags")
        .or_insert_with(|| Value::Array(Vec::new()))
        .as_array_mut()
        .ok_or_else(|| TagError::InvalidItemMetadata(id.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct TempLibrary(PathBuf);

    impl TempLibrary {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("swallow-tags-{}", ulid::Ulid::generate()));
            fs::create_dir_all(path.join(IMAGES_DIR)).unwrap();
            Self(path)
        }

        fn add_item(&self, id: &str, tags: &[&str]) {
            let dir = self.0.join(IMAGES_DIR).join(format!("{id}.info"));
            fs::create_dir_all(&dir).unwrap();
            let metadata = json!({ "id": id, "name": "sample", "tags": tags, "star": 3 });
            fs::write(dir.join(ITEM_METADATA_FILE), metadata.to_string()).unwrap();
        }

        fn item(&self, id: &str) -> Value {
            let path = item_metadata_path(&self.0, id).unwrap();
            serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
        }

        fn item_tags(&self, id: &str) -> Value {
            self.item(id)["tags"].clone()
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
            json!({ "tags": ["cat"], "groups": [{ "id": "g1", "name": "Animals", "tags": ["cat"] }] })
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
        assert_eq!(lib.item_tags("A"), json!(["dog"]));
        assert_eq!(lib.item_tags("B"), json!(["dog"]));
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

        assert_eq!(lib.item_tags("A"), json!(["cat", "red"]));
        assert_eq!(lib.item_tags("B"), json!(["cat", "red"]));
        assert_eq!(tags.tags, strings(&["cat", "red"]));
        assert_eq!(lib.item("A")["star"], json!(3));
    }

    #[test]
    fn remove_item_tags_from_multiple_items() {
        let lib = TempLibrary::new();
        lib.add_item("A", &["cat", "red"]);
        lib.add_item("B", &["red", "dog"]);

        remove_item_tags(&lib.0, &strings(&["A", "B"]), &strings(&["red", "cat"])).unwrap();

        assert_eq!(lib.item_tags("A"), json!([]));
        assert_eq!(lib.item_tags("B"), json!(["dog"]));
    }

    #[test]
    fn unknown_item_leaves_all_items_untouched() {
        let lib = TempLibrary::new();
        lib.add_item("A", &[]);

        let result = add_item_tags(&lib.0, &strings(&["A", "MISSING"]), &strings(&["cat"]));

        assert!(matches!(result, Err(TagError::ItemNotFound(_))));
        assert_eq!(lib.item_tags("A"), json!([]));
        assert!(load(&lib.0).unwrap().tags.is_empty());
    }

    #[test]
    fn rejects_path_traversal_in_item_id() {
        let lib = TempLibrary::new();
        assert!(matches!(
            add_item_tags(&lib.0, &strings(&["../x"]), &strings(&["cat"])),
            Err(TagError::InvalidItemId(_))
        ));
    }
}
