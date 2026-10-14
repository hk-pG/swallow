use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use ulid::Ulid;

use crate::item::{ITEM_DIR_EXT, ITEM_METADATA_FILE, ItemMetadata, now_millis};
use crate::library::IMAGES_DIR;

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

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("not a library: {} does not exist", .0.display())]
    NotALibrary(PathBuf),
    #[error("unsupported extension: {0:?}")]
    UnsupportedExtension(String),
    #[error(transparent)]
    Io(#[from] io::Error),
}

/// An asset received as bytes rather than a file on disk, e.g. from the HTTP API.
#[derive(Debug)]
pub struct BytesImport<'a> {
    pub name: &'a str,
    pub ext: &'a str,
    pub url: Option<&'a str>,
    pub bytes: &'a [u8],
}

enum Content<'a> {
    File(&'a Path),
    Bytes(&'a [u8]),
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
pub fn import_files(library: &Path, paths: &[PathBuf]) -> Result<ImportReport, ImportError> {
    let images_dir = images_dir(library)?;
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

/// Stores `asset.bytes` as a new item. `name` must already be a valid file stem.
pub fn import_bytes(library: &Path, asset: &BytesImport<'_>) -> Result<ItemMetadata, ImportError> {
    let images_dir = images_dir(library)?;
    let ext = asset.ext.to_lowercase();
    if !is_supported(&ext) {
        return Err(ImportError::UnsupportedExtension(ext));
    }
    let content = Content::Bytes(asset.bytes);
    let dims = dimensions(&content, &ext);
    let item = new_item(
        asset.name.to_owned(),
        ext,
        asset.bytes.len() as u64,
        dims,
        asset.url.map(str::to_owned),
        now_millis(),
    );
    store_item(&images_dir, content, &item)?;
    Ok(item)
}

fn images_dir(library: &Path) -> Result<PathBuf, ImportError> {
    let images_dir = library.join(IMAGES_DIR);
    if !images_dir.is_dir() {
        return Err(ImportError::NotALibrary(images_dir));
    }
    Ok(images_dir)
}

fn is_supported(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext)
}

fn new_item(
    name: String,
    ext: String,
    size: u64,
    dimensions: Option<(u32, u32)>,
    url: Option<String>,
    now: i64,
) -> ItemMetadata {
    let (width, height) = dimensions.unzip();
    ItemMetadata {
        id: Ulid::generate().to_string(),
        name,
        ext,
        size,
        width,
        height,
        tags: Vec::new(),
        folders: Vec::new(),
        annotation: String::new(),
        star: 0,
        url,
        created_at: now,
        modified_at: now,
        is_deleted: false,
    }
}

fn store_item(images_dir: &Path, content: Content<'_>, item: &ItemMetadata) -> io::Result<()> {
    // Staged under a different name so readers never see a half-written item directory.
    let staging = images_dir.join(format!("{}.{ITEM_DIR_EXT}.tmp", item.id));
    let result = write_item(&staging, content, item).and_then(|()| {
        fs::rename(
            &staging,
            images_dir.join(format!("{}.{ITEM_DIR_EXT}", item.id)),
        )
    });
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn import_one(images_dir: &Path, source: &Path, now: i64) -> Result<ItemMetadata, ImportFailure> {
    let ext = source
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if !is_supported(&ext) {
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
    let content = Content::File(source);
    let dims = dimensions(&content, &ext);
    let item = new_item(name, ext, meta.len(), dims, None, now);
    store_item(images_dir, content, &item).map_err(|err| ImportFailure::io(source, &err))?;
    Ok(item)
}

fn write_item(dir: &Path, content: Content<'_>, item: &ItemMetadata) -> io::Result<()> {
    fs::create_dir(dir)?;
    let file = crate::item::item_file(dir, item)?;
    match content {
        Content::File(source) => fs::copy(source, file).map(drop)?,
        Content::Bytes(bytes) => fs::write(file, bytes)?,
    }
    let json = serde_json::to_vec_pretty(item).map_err(io::Error::other)?;
    fs::write(dir.join(ITEM_METADATA_FILE), json)
}

fn dimensions(content: &Content<'_>, ext: &str) -> Option<(u32, u32)> {
    let size = match (ext, content) {
        ("pdf", _) => return None,
        ("svg", Content::File(path)) => return svg_dimensions(&fs::read_to_string(path).ok()?),
        ("svg", Content::Bytes(bytes)) => return svg_dimensions(std::str::from_utf8(bytes).ok()?),
        (_, Content::File(path)) => imagesize::size(path).ok()?,
        (_, Content::Bytes(bytes)) => imagesize::blob_size(bytes).ok()?,
    };
    Some((size.width.try_into().ok()?, size.height.try_into().ok()?))
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
        fs::create_dir(dir.path().join(IMAGES_DIR)).unwrap();
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

        let item_dir = crate::item::item_dir(lib.path(), &item.id);
        assert_eq!(fs::read(item_dir.join("Photo.png")).unwrap(), png(640, 480));
        assert_eq!(&crate::item::read_item(&item_dir).unwrap(), item);
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
        assert_eq!(
            fs::read_dir(lib.path().join(IMAGES_DIR)).unwrap().count(),
            1
        );
    }

    #[test]
    fn imports_bytes_with_source_url() {
        let lib = library();
        let bytes = png(32, 16);
        let item = import_bytes(
            lib.path(),
            &BytesImport {
                name: "cat",
                ext: "PNG",
                url: Some("https://example.com/page"),
                bytes: &bytes,
            },
        )
        .unwrap();

        assert_eq!((item.name.as_str(), item.ext.as_str()), ("cat", "png"));
        assert_eq!(item.size, bytes.len() as u64);
        assert_eq!((item.width, item.height), (Some(32), Some(16)));
        assert_eq!(item.url.as_deref(), Some("https://example.com/page"));
        let item_dir = crate::item::item_dir(lib.path(), &item.id);
        assert_eq!(fs::read(item_dir.join("cat.png")).unwrap(), bytes);
        assert_eq!(crate::item::read_item(&item_dir).unwrap(), item);
    }

    #[test]
    fn import_bytes_rejects_unsupported_extension_and_bad_name() {
        let lib = library();
        let asset = |name, ext| BytesImport {
            name,
            ext,
            url: None,
            bytes: b"x",
        };
        assert!(matches!(
            import_bytes(lib.path(), &asset("a", "exe")),
            Err(ImportError::UnsupportedExtension(_))
        ));
        assert!(matches!(
            import_bytes(lib.path(), &asset("../a", "png")),
            Err(ImportError::Io(_))
        ));
        assert!(matches!(
            import_bytes(tempfile::tempdir().unwrap().path(), &asset("a", "png")),
            Err(ImportError::NotALibrary(_))
        ));
        assert_eq!(
            fs::read_dir(lib.path().join(IMAGES_DIR)).unwrap().count(),
            0
        );
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
