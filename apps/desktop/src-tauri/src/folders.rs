use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::item::{self, ItemError};
use crate::library::{Folder, METADATA_FILE, write_json_atomic};

#[derive(Debug, thiserror::Error)]
pub enum FolderError {
    #[error("フォルダ名を入力してください")]
    EmptyName,
    #[error("フォルダが見つかりません: {0}")]
    FolderNotFound(String),
    #[error("フォルダを自身またはその配下には移動できません")]
    MoveIntoSelf,
    #[error(transparent)]
    Item(#[from] ItemError),
    #[error("{path}: {source}")]
    Io { path: PathBuf, source: io::Error },
    #[error("{path}: {source}")]
    Json {
        path: PathBuf,
        source: serde_json::Error,
    },
}

fn io_err(path: &Path) -> impl FnOnce(io::Error) -> FolderError + '_ {
    move |source| FolderError::Io {
        path: path.to_path_buf(),
        source,
    }
}

fn json_err(path: &Path) -> impl FnOnce(serde_json::Error) -> FolderError + '_ {
    move |source| FolderError::Json {
        path: path.to_path_buf(),
        source,
    }
}

fn read_json(path: &Path) -> Result<Value, FolderError> {
    let raw = fs::read(path).map_err(io_err(path))?;
    serde_json::from_slice(&raw).map_err(json_err(path))
}

fn normalize_name(name: &str) -> Result<String, FolderError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(FolderError::EmptyName);
    }
    Ok(name.to_owned())
}

fn find<'a>(folders: &'a [Folder], id: &str) -> Option<&'a Folder> {
    folders.iter().find_map(|f| {
        if f.id == id {
            Some(f)
        } else {
            find(&f.children, id)
        }
    })
}

fn find_mut<'a>(folders: &'a mut [Folder], id: &str) -> Option<&'a mut Folder> {
    for f in folders {
        if f.id == id {
            return Some(f);
        }
        if let Some(found) = find_mut(&mut f.children, id) {
            return Some(found);
        }
    }
    None
}

/// Detaches the folder (with its subtree) from wherever it sits in the tree.
fn take(folders: &mut Vec<Folder>, id: &str) -> Option<Folder> {
    if let Some(pos) = folders.iter().position(|f| f.id == id) {
        return Some(folders.remove(pos));
    }
    folders.iter_mut().find_map(|f| take(&mut f.children, id))
}

fn collect_ids(folder: &Folder, out: &mut Vec<String>) {
    out.push(folder.id.clone());
    for child in &folder.children {
        collect_ids(child, out);
    }
}

/// IDs of the folder and all of its descendants, for filtering items by a folder selection.
pub fn subtree_ids(folders: &[Folder], id: &str) -> Option<Vec<String>> {
    let folder = find(folders, id)?;
    let mut ids = Vec::new();
    collect_ids(folder, &mut ids);
    Some(ids)
}

struct LibraryDoc {
    path: PathBuf,
    raw: Value,
    pub(crate) folders: Vec<Folder>,
}

impl LibraryDoc {
    pub(crate) fn load(root: &Path) -> Result<Self, FolderError> {
        let path = root.join(METADATA_FILE);
        let raw = read_json(&path)?;
        let folders = match raw.get("folders") {
            Some(v) => serde_json::from_value(v.clone()).map_err(json_err(&path))?,
            None => Vec::new(),
        };
        Ok(Self { path, raw, folders })
    }

    /// Replaces only `folders`, preserving every other field of `metadata.json`.
    pub(crate) fn save(mut self) -> Result<Vec<Folder>, FolderError> {
        let folders = serde_json::to_value(&self.folders).map_err(json_err(&self.path))?;
        match self.raw.as_object_mut() {
            Some(obj) => {
                obj.insert("folders".into(), folders);
            }
            None => self.raw = serde_json::json!({ "folders": folders }),
        }
        write_json_atomic(&self.path, &self.raw).map_err(io_err(&self.path))?;
        Ok(self.folders)
    }
}

pub(crate) struct FolderHierarchy {
    doc: LibraryDoc,
    dirty: bool,
}

impl FolderHierarchy {
    pub(crate) fn load(library: &Path) -> Result<Self, FolderError> {
        let doc = LibraryDoc::load(library)?;
        Ok(Self { doc, dirty: false })
    }

    /// Finds an existing child with `name` under `parent_id` (or at the top level when `None`),
    /// or appends a new folder with that name.
    pub(crate) fn ensure_child(
        &mut self,
        parent_id: Option<&str>,
        name: &str,
    ) -> Result<String, FolderError> {
        let name = normalize_name(name)?;
        let siblings = match parent_id {
            Some(pid) => {
                &mut find_mut(&mut self.doc.folders, pid)
                    .ok_or_else(|| FolderError::FolderNotFound(pid.to_owned()))?
                    .children
            }
            None => &mut doc_top(&mut self.doc),
        };
        if let Some(existing) = siblings.iter().find(|f| f.name == name) {
            return Ok(existing.id.clone());
        }
        let id = ulid::Ulid::generate().to_string();
        siblings.push(Folder {
            id: id.clone(),
            name,
            children: Vec::new(),
        });
        self.dirty = true;
        Ok(id)
    }

    pub(crate) fn save_if_dirty(self) -> Result<(), FolderError> {
        if self.dirty {
            self.doc.save()?;
        }
        Ok(())
    }
}

fn doc_top(doc: &mut LibraryDoc) -> &mut Vec<Folder> {
    &mut doc.folders
}

pub fn list(root: &Path) -> Result<Vec<Folder>, FolderError> {
    Ok(LibraryDoc::load(root)?.folders)
}

/// Creates a folder at the end of `parent_id`'s children, or at the top level when `None`.
pub fn create(root: &Path, parent_id: Option<&str>, name: &str) -> Result<Folder, FolderError> {
    let name = normalize_name(name)?;
    let mut doc = LibraryDoc::load(root)?;
    let folder = Folder {
        id: ulid::Ulid::generate().to_string(),
        name,
        children: Vec::new(),
    };
    let siblings = match parent_id {
        Some(pid) => {
            &mut find_mut(&mut doc.folders, pid)
                .ok_or_else(|| FolderError::FolderNotFound(pid.to_owned()))?
                .children
        }
        None => &mut doc.folders,
    };
    siblings.push(folder.clone());
    doc.save()?;
    Ok(folder)
}

pub fn rename(root: &Path, id: &str, name: &str) -> Result<Folder, FolderError> {
    let name = normalize_name(name)?;
    let mut doc = LibraryDoc::load(root)?;
    let folder =
        find_mut(&mut doc.folders, id).ok_or_else(|| FolderError::FolderNotFound(id.to_owned()))?;
    folder.name = name;
    let renamed = folder.clone();
    doc.save()?;
    Ok(renamed)
}

/// Moves a folder under `parent_id` (top level when `None`) at `index`, or at the end when
/// `index` is `None` or out of range.
pub fn move_to(
    root: &Path,
    id: &str,
    parent_id: Option<&str>,
    index: Option<usize>,
) -> Result<Vec<Folder>, FolderError> {
    let mut doc = LibraryDoc::load(root)?;
    let subtree =
        subtree_ids(&doc.folders, id).ok_or_else(|| FolderError::FolderNotFound(id.to_owned()))?;
    if let Some(pid) = parent_id {
        if subtree.iter().any(|s| s == pid) {
            return Err(FolderError::MoveIntoSelf);
        }
        if find(&doc.folders, pid).is_none() {
            return Err(FolderError::FolderNotFound(pid.to_owned()));
        }
    }
    let folder = take(&mut doc.folders, id).expect("folder existence checked above");
    let siblings = match parent_id {
        Some(pid) => {
            &mut find_mut(&mut doc.folders, pid)
                .expect("parent existence checked above")
                .children
        }
        None => &mut doc.folders,
    };
    let index = index.unwrap_or(siblings.len()).min(siblings.len());
    siblings.insert(index, folder);
    doc.save()
}

/// Deletes the folder with its subfolders and unassigns them from every item. Items
/// themselves are kept.
pub fn delete(root: &Path, id: &str) -> Result<Vec<Folder>, FolderError> {
    let mut doc = LibraryDoc::load(root)?;
    let folder =
        take(&mut doc.folders, id).ok_or_else(|| FolderError::FolderNotFound(id.to_owned()))?;
    let mut removed = Vec::new();
    collect_ids(&folder, &mut removed);
    let folders = doc.save()?;

    let removed: HashSet<&str> = removed.iter().map(String::as_str).collect();
    item::edit_all_items(root, |item| {
        item.folders.retain(|f| !removed.contains(f.as_str()));
    })?;
    Ok(folders)
}

/// Adds `folder_id` to each item's folders. An item can belong to any number of folders.
pub fn assign_items(root: &Path, item_ids: &[String], folder_id: &str) -> Result<(), FolderError> {
    if find(&LibraryDoc::load(root)?.folders, folder_id).is_none() {
        return Err(FolderError::FolderNotFound(folder_id.to_owned()));
    }
    item::edit_items(root, item_ids, |item| {
        if !item.folders.iter().any(|f| f == folder_id) {
            item.folders.push(folder_id.to_owned());
        }
    })?;
    Ok(())
}

pub fn unassign_items(
    root: &Path,
    item_ids: &[String],
    folder_id: &str,
) -> Result<(), FolderError> {
    item::edit_items(root, item_ids, |item| {
        item.folders.retain(|f| f != folder_id);
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::ItemMetadata;
    use crate::item::tests::{sample_item, write_item};
    use crate::library::IMAGES_DIR;

    fn library() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join(IMAGES_DIR)).unwrap();
        fs::write(
            dir.path().join(METADATA_FILE),
            r#"{ "name": "lib", "version": 1, "folders": [] }"#,
        )
        .unwrap();
        dir
    }

    fn add_item(root: &Path, id: &str, folders: &[&str]) {
        let item = ItemMetadata {
            folders: folders.iter().map(|f| f.to_string()).collect(),
            star: 3,
            ..sample_item(id, "a", "png")
        };
        write_item(root, &item);
    }

    fn item_folders(root: &Path, id: &str) -> Vec<String> {
        item::load_item(root, id).unwrap().folders
    }

    fn names(folders: &[Folder]) -> Vec<&str> {
        folders.iter().map(|f| f.name.as_str()).collect()
    }

    #[test]
    fn ensure_child_reuses_existing_sibling_name() {
        let lib = library();
        let mut hierarchy = FolderHierarchy::load(lib.path()).unwrap();
        let a = hierarchy.ensure_child(None, "Photos").unwrap();
        let b = hierarchy.ensure_child(None, "Photos").unwrap();
        assert_eq!(a, b);
        hierarchy.save_if_dirty().unwrap();
        assert_eq!(list(lib.path()).unwrap().len(), 1);
    }

    #[test]
    fn create_nests_and_persists_while_preserving_other_fields() {
        let lib = library();
        let parent = create(lib.path(), None, " Photos ").unwrap();
        let child = create(lib.path(), Some(&parent.id), "Cats").unwrap();

        let folders = list(lib.path()).unwrap();
        assert_eq!(names(&folders), ["Photos"]);
        assert_eq!(folders[0].children, [child]);

        let raw = read_json(&lib.path().join(METADATA_FILE)).unwrap();
        assert_eq!(raw["name"], "lib");
        assert_eq!(raw["version"], 1);
    }

    #[test]
    fn create_rejects_blank_name_and_unknown_parent() {
        let lib = library();
        assert!(matches!(
            create(lib.path(), None, "  "),
            Err(FolderError::EmptyName)
        ));
        assert!(matches!(
            create(lib.path(), Some("nope"), "x"),
            Err(FolderError::FolderNotFound(_))
        ));
    }

    #[test]
    fn rename_updates_nested_folder() {
        let lib = library();
        let parent = create(lib.path(), None, "a").unwrap();
        let child = create(lib.path(), Some(&parent.id), "b").unwrap();

        rename(lib.path(), &child.id, "c").unwrap();

        assert_eq!(list(lib.path()).unwrap()[0].children[0].name, "c");
    }

    #[test]
    fn move_reorders_and_reparents() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        let b = create(lib.path(), None, "b").unwrap();

        let folders = move_to(lib.path(), &b.id, None, Some(0)).unwrap();
        assert_eq!(names(&folders), ["b", "a"]);

        let folders = move_to(lib.path(), &b.id, Some(&a.id), None).unwrap();
        assert_eq!(names(&folders), ["a"]);
        assert_eq!(names(&folders[0].children), ["b"]);
    }

    #[test]
    fn move_rejects_moving_into_own_subtree() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        let b = create(lib.path(), Some(&a.id), "b").unwrap();

        assert!(matches!(
            move_to(lib.path(), &a.id, Some(&b.id), None),
            Err(FolderError::MoveIntoSelf)
        ));
        assert!(matches!(
            move_to(lib.path(), &a.id, Some(&a.id), None),
            Err(FolderError::MoveIntoSelf)
        ));
    }

    #[test]
    fn delete_removes_subtree_and_unassigns_items() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        let b = create(lib.path(), Some(&a.id), "b").unwrap();
        let keep = create(lib.path(), None, "keep").unwrap();
        add_item(lib.path(), "ITEM1", &[&b.id, &keep.id]);

        let folders = delete(lib.path(), &a.id).unwrap();

        assert_eq!(names(&folders), ["keep"]);
        assert_eq!(item_folders(lib.path(), "ITEM1"), [keep.id]);
    }

    #[test]
    fn assign_and_unassign_items_across_multiple_folders() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        let b = create(lib.path(), None, "b").unwrap();
        add_item(lib.path(), "ITEM1", &[]);
        let items = ["ITEM1".to_owned()];

        assign_items(lib.path(), &items, &a.id).unwrap();
        assign_items(lib.path(), &items, &b.id).unwrap();
        assign_items(lib.path(), &items, &a.id).unwrap();
        assert_eq!(
            item_folders(lib.path(), "ITEM1"),
            [a.id.clone(), b.id.clone()]
        );

        unassign_items(lib.path(), &items, &a.id).unwrap();
        assert_eq!(item_folders(lib.path(), "ITEM1"), [b.id]);
        assert_eq!(item::load_item(lib.path(), "ITEM1").unwrap().star, 3);
    }

    #[test]
    fn assign_rejects_unknown_folder_and_invalid_item_ids() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        add_item(lib.path(), "ITEM1", &[]);

        assert!(matches!(
            assign_items(lib.path(), &["ITEM1".into()], "nope"),
            Err(FolderError::FolderNotFound(_))
        ));
        assert!(matches!(
            assign_items(lib.path(), &["MISSING".into()], &a.id),
            Err(FolderError::Item(ItemError::NotFound(_)))
        ));
        for bad in ["../ITEM1", ""] {
            assert!(matches!(
                assign_items(lib.path(), &[bad.into()], &a.id),
                Err(FolderError::Item(ItemError::InvalidId(_)))
            ));
        }
    }

    #[test]
    fn subtree_ids_includes_descendants() {
        let lib = library();
        let a = create(lib.path(), None, "a").unwrap();
        let b = create(lib.path(), Some(&a.id), "b").unwrap();
        let c = create(lib.path(), Some(&b.id), "c").unwrap();
        create(lib.path(), None, "other").unwrap();

        let folders = list(lib.path()).unwrap();
        assert_eq!(
            subtree_ids(&folders, &a.id).unwrap(),
            [a.id.clone(), b.id, c.id]
        );
        assert_eq!(subtree_ids(&folders, "nope"), None);
    }

    #[test]
    fn folder_serializes_with_shared_field_names() {
        let folder = Folder {
            id: "F".into(),
            name: "n".into(),
            children: Vec::new(),
        };
        assert_eq!(
            serde_json::to_value(&folder).unwrap(),
            serde_json::json!({ "id": "F", "name": "n", "children": [] })
        );
    }
}
