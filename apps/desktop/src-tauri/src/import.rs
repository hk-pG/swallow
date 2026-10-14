use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use ulid::Ulid;

use crate::item::ItemMetadata;

/// Mirrors `SUPPORTED_IMPORT_EXTENSIONS` in `packages/shared/src/import.ts`.
pub const SUPPORTED_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "svg", "pdf"];

/// Mirrors `ImportReport` in `packages/shared/src/import.ts`.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub imported: Vec<ItemMetadata>,
    pub failed: Vec<ImportFailure>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFailure {
    pub path: String,
    pub reason: ImportFailureReason,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ImportFailureReason {
    UnsupportedExtension,
    NotFound,
    NotAFile,
    Io,
}

impl ImportFailure {
    fn new(path: &Path, reason: ImportFailureReason, message: impl Into<String>) -> Self {
        Self {
            path: path.to_string_lossy().into_owned(),
            reason,
            message: message.into(),
        }
    }

    fn io(path: &Path, err: &io::Error) -> Self {
        let reason = if err.kind() == io::ErrorKind::NotFound {
            ImportFailureReason::NotFound
        } else {
            ImportFailureReason::Io
        };
        Self::new(path, reason, err.to_string())
    }
}

/// Copies each file into `<library>/images/<id>.info/` alongside its `metadata.json`.
///
/// Per-file failures are collected in the report; only an invalid library aborts the whole call.
pub fn import_files(library: &Path, paths: &[PathBuf]) -> Result<ImportReport, String> {
    let images_dir = library.join("images");
    if !images_dir.is_dir() {
        return Err(format!(
            "not a library: {} does not exist",
            images_dir.display()
        ));
    }

    let now = now_millis();
    let mut report = ImportReport::default();
    for path in paths {
        match import_one(&images_dir, path, now) {
            Ok(item) => report.imported.push(item),
            Err(failure) => report.failed.push(failure),
        }
    }
    Ok(report)
}

fn import_one(images_dir: &Path, source: &Path, now: i64) -> Result<ItemMetadata, ImportFailure> {
    let ext = source
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if !SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(ImportFailure::new(
            source,
            ImportFailureReason::UnsupportedExtension,
            format!("unsupported extension: {ext:?}"),
        ));
    }

    let meta = fs::metadata(source).map_err(|e| ImportFailure::io(source, &e))?;
    if !meta.is_file() {
        return Err(ImportFailure::new(
            source,
            ImportFailureReason::NotAFile,
            "not a regular file",
        ));
    }

    let name = source
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let (width, height) = match dimensions(source, &ext) {
        Some((w, h)) => (Some(w), Some(h)),
        None => (None, None),
    };

    let id = Ulid::generate().to_string();
    let item = ItemMetadata {
        id: id.clone(),
        name: name.clone(),
        ext: ext.clone(),
        size: meta.len(),
        width,
        height,
        tags: Vec::new(),
        folders: Vec::new(),
        annotation: String::new(),
        star: 0,
        url: None,
        created_at: now,
        modified_at: now,
        is_deleted: false,
    };

    // Staged under a different name so readers never see a half-written item directory.
    let staging = images_dir.join(format!("{id}.info.tmp"));
    let result = write_item(&staging, source, &format!("{name}.{ext}"), &item)
        .and_then(|()| fs::rename(&staging, images_dir.join(format!("{id}.info"))));
    if let Err(err) = result {
        let _ = fs::remove_dir_all(&staging);
        return Err(ImportFailure::io(source, &err));
    }
    Ok(item)
}

fn write_item(dir: &Path, source: &Path, file_name: &str, item: &ItemMetadata) -> io::Result<()> {
    fs::create_dir(dir)?;
    fs::copy(source, dir.join(file_name))?;
    let json = serde_json::to_vec_pretty(item).map_err(io::Error::other)?;
    fs::write(dir.join("metadata.json"), json)
}

fn dimensions(path: &Path, ext: &str) -> Option<(u32, u32)> {
    match ext {
        "pdf" => None,
        "svg" => svg_dimensions(&fs::read_to_string(path).ok()?),
        _ => {
            let size = imagesize::size(path).ok()?;
            Some((size.width.try_into().ok()?, size.height.try_into().ok()?))
        }
    }
}

/// Reads `width`/`height` (unitless or `px`) from the root `<svg>` tag, falling back to `viewBox`.
fn svg_dimensions(src: &str) -> Option<(u32, u32)> {
    let start = src.find("<svg")?;
    let end = start + src[start..].find('>')?;
    let tag = &src[start..end];

    let width = attr(tag, "width").and_then(parse_px);
    let height = attr(tag, "height").and_then(parse_px);
    if let (Some(w), Some(h)) = (width, height) {
        return Some((w, h));
    }

    let view_box: Vec<f64> = attr(tag, "viewBox")?
        .split(|c: char| c.is_whitespace() || c == ',')
        .filter(|s| !s.is_empty())
        .map(str::parse)
        .collect::<Result<_, _>>()
        .ok()?;
    match view_box[..] {
        [_, _, w, h] => Some((to_px(w)?, to_px(h)?)),
        _ => None,
    }
}

fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let mut offset = 0;
    while let Some(found) = tag[offset..].find(name) {
        let at = offset + found;
        offset = at + name.len();
        let preceded_by_space = tag[..at]
            .chars()
            .next_back()
            .is_some_and(char::is_whitespace);
        let Some(rest) = tag[offset..].trim_start().strip_prefix('=') else {
            continue;
        };
        if !preceded_by_space {
            continue;
        }
        let rest = rest.trim_start();
        let quote = rest.chars().next().filter(|c| *c == '"' || *c == '\'')?;
        let value = &rest[1..];
        return value.find(quote).map(|e| &value[..e]);
    }
    None
}

fn parse_px(value: &str) -> Option<u32> {
    let value = value.trim();
    to_px(value.strip_suffix("px").unwrap_or(value).parse().ok()?)
}

fn to_px(value: f64) -> Option<u32> {
    (value.is_finite() && value > 0.0 && value <= f64::from(u32::MAX)).then(|| value.round() as u32)
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        bytes.extend_from_slice(&width.to_be_bytes());
        bytes.extend_from_slice(&height.to_be_bytes());
        bytes.extend_from_slice(&[8, 6, 0, 0, 0, 0, 0, 0, 0]);
        bytes
    }

    fn library() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("images")).unwrap();
        dir
    }

    #[test]
    fn imports_file_with_metadata() {
        let lib = library();
        let src_dir = tempfile::tempdir().unwrap();
        let src = src_dir.path().join("Photo.PNG");
        fs::write(&src, png(640, 480)).unwrap();

        let report = import_files(lib.path(), std::slice::from_ref(&src)).unwrap();

        assert!(report.failed.is_empty());
        let item = &report.imported[0];
        assert_eq!(item.id.len(), 26);
        assert_eq!(item.name, "Photo");
        assert_eq!(item.ext, "png");
        assert_eq!(item.size, png(640, 480).len() as u64);
        assert_eq!((item.width, item.height), (Some(640), Some(480)));
        assert!(item.created_at > 0);
        assert_eq!(item.created_at, item.modified_at);

        let item_dir = lib.path().join("images").join(format!("{}.info", item.id));
        assert_eq!(fs::read(item_dir.join("Photo.png")).unwrap(), png(640, 480));
        let saved: ItemMetadata =
            serde_json::from_slice(&fs::read(item_dir.join("metadata.json")).unwrap()).unwrap();
        assert_eq!(&saved, item);
    }

    #[test]
    fn reports_partial_failures() {
        let lib = library();
        let src_dir = tempfile::tempdir().unwrap();
        let ok = src_dir.path().join("ok.png");
        fs::write(&ok, png(1, 1)).unwrap();
        let unsupported = src_dir.path().join("notes.txt");
        fs::write(&unsupported, "x").unwrap();
        let missing = src_dir.path().join("missing.jpg");
        let folder = src_dir.path().join("folder.png");
        fs::create_dir(&folder).unwrap();

        let report = import_files(lib.path(), &[ok, unsupported, missing, folder]).unwrap();

        assert_eq!(report.imported.len(), 1);
        let reasons: Vec<_> = report.failed.iter().map(|f| f.reason).collect();
        assert_eq!(
            reasons,
            [
                ImportFailureReason::UnsupportedExtension,
                ImportFailureReason::NotFound,
                ImportFailureReason::NotAFile,
            ]
        );
        assert_eq!(fs::read_dir(lib.path().join("images")).unwrap().count(), 1);
    }

    #[test]
    fn rejects_directory_without_images() {
        let dir = tempfile::tempdir().unwrap();
        assert!(import_files(dir.path(), &[]).is_err());
    }

    #[test]
    fn reads_svg_dimensions() {
        assert_eq!(
            svg_dimensions(r#"<?xml version="1.0"?><svg xmlns="x" width="120px" height='80'>"#),
            Some((120, 80))
        );
        assert_eq!(
            svg_dimensions(r#"<svg stroke-width="3" width="100%" viewBox="0 0 24.4 12">"#),
            Some((24, 12))
        );
        assert_eq!(svg_dimensions(r#"<svg width="10em" height="2em">"#), None);
        assert_eq!(svg_dimensions("not svg"), None);
    }
}
