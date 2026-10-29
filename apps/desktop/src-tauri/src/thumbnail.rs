use crate::item::{self, ITEM_DIR_EXT, ItemMetadata};
use crate::library::IMAGES_DIR;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Mirrors `THUMBNAIL_EXTS` in `packages/shared/src/library.ts`.
const RASTER_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp"];
const SVG_EXT: &str = "svg";

pub const THUMBNAIL_FILE: &str = "thumbnail.png";
/// Longest side in pixels. Large enough for grid cells on HiDPI displays.
pub const THUMBNAIL_MAX_SIZE: u32 = 320;

#[derive(Debug, PartialEq, Eq)]
pub struct Preview {
    pub path: PathBuf,
    pub mime: &'static str,
}

/// Generates `images/<id>.info/thumbnail.png` unless an up-to-date one exists.
/// Returns `None` for items that have no raster preview.
pub fn ensure_thumbnail(item_dir: &Path, item: &ItemMetadata) -> io::Result<Option<PathBuf>> {
    if !is_raster(&item.ext) {
        return Ok(None);
    }
    let source = item::item_file(item_dir, item)?;
    let thumbnail = item_dir.join(THUMBNAIL_FILE);
    if is_fresh(&thumbnail, &source) {
        return Ok(Some(thumbnail));
    }

    let image = decode(&source).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let image = if image.width() > THUMBNAIL_MAX_SIZE || image.height() > THUMBNAIL_MAX_SIZE {
        image.thumbnail(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE)
    } else {
        image
    };

    // Concurrent requests for the same item must never observe a half-written file.
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let tmp = item_dir.join(format!(
        ".{THUMBNAIL_FILE}.{}.{}.tmp",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let written = image
        .save_with_format(&tmp, ImageFormat::Png)
        .map_err(io::Error::other)
        .and_then(|()| fs::rename(&tmp, &thumbnail));
    if written.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    written.map(|()| Some(thumbnail))
}

/// Resolves what the grid should display for an item directory, generating
/// the thumbnail on first access.
pub fn preview(item_dir: &Path) -> io::Result<Option<Preview>> {
    let item = item::read_item(item_dir)?;
    if item.ext.eq_ignore_ascii_case(SVG_EXT) {
        return Ok(Some(Preview {
            path: item::item_file(item_dir, &item)?,
            mime: "image/svg+xml",
        }));
    }
    Ok(ensure_thumbnail(item_dir, &item)?.map(|path| Preview {
        path,
        mime: "image/png",
    }))
}

/// Resolves the original stored image for Quick Look, without downscaling.
pub fn original_preview(item_dir: &Path) -> io::Result<Option<Preview>> {
    let item = item::read_item(item_dir)?;
    let Some(mime) = image_mime(&item.ext) else {
        return Ok(None);
    };
    Ok(Some(Preview {
        path: item::item_file(item_dir, &item)?,
        mime,
    }))
}

fn image_mime(ext: &str) -> Option<&'static str> {
    if ext.eq_ignore_ascii_case("png") {
        Some("image/png")
    } else if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") {
        Some("image/jpeg")
    } else if ext.eq_ignore_ascii_case("webp") {
        Some("image/webp")
    } else if ext.eq_ignore_ascii_case("gif") {
        Some("image/gif")
    } else if ext.eq_ignore_ascii_case("bmp") {
        Some("image/bmp")
    } else if ext.eq_ignore_ascii_case(SVG_EXT) {
        Some("image/svg+xml")
    } else {
        None
    }
}

/// Accepts only `.../images/<id>.info` so the protocol cannot be used to read arbitrary files.
pub fn is_item_dir(path: &Path) -> bool {
    path.is_absolute()
        && path.extension().is_some_and(|ext| ext == ITEM_DIR_EXT)
        && path
            .parent()
            .and_then(Path::file_name)
            .is_some_and(|name| name == IMAGES_DIR)
}

/// Reads `path` only when it is a regular file under a real (non-symlink) item directory.
///
/// Shape checks alone are not enough: a symlink under `images/<id>.info` would let
/// `fs::read` escape the item dir. Rejects symlinks and requires the canonical path
/// to stay under the canonical item dir (which must still match [`is_item_dir`]).
pub fn read_within_item_dir(item_dir: &Path, path: &Path) -> io::Result<Vec<u8>> {
    let item_meta = fs::symlink_metadata(item_dir)?;
    if item_meta.file_type().is_symlink() || !item_meta.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "item dir must be a real directory",
        ));
    }
    let canon_item = fs::canonicalize(item_dir)?;
    if !is_item_dir(&canon_item) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "item dir escaped library layout",
        ));
    }

    let file_meta = fs::symlink_metadata(path)?;
    if file_meta.file_type().is_symlink() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "refusing to follow symlink",
        ));
    }
    if !file_meta.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "preview path is not a file",
        ));
    }
    let canon_path = fs::canonicalize(path)?;
    if !canon_path.starts_with(&canon_item) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "preview path escaped item dir",
        ));
    }
    fs::read(canon_path)
}

fn is_raster(ext: &str) -> bool {
    RASTER_EXTS.iter().any(|e| e.eq_ignore_ascii_case(ext))
}

fn is_fresh(thumbnail: &Path, source: &Path) -> bool {
    let modified = |p: &Path| fs::metadata(p).and_then(|m| m.modified());
    match (modified(thumbnail), modified(source)) {
        (Ok(thumb), Ok(src)) => thumb >= src,
        (Ok(_), Err(_)) => true,
        _ => false,
    }
}

fn decode(path: &Path) -> image::ImageResult<DynamicImage> {
    let mut decoder = ImageReader::open(path)?
        .with_guessed_format()?
        .into_decoder()?;
    let orientation = decoder.orientation()?;
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    Ok(image)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::tests::{sample_item, write_item};
    use image::{GenericImageView, RgbaImage};

    fn write_png(dir: &Path, name: &str, width: u32, height: u32) {
        RgbaImage::new(width, height)
            .save_with_format(dir.join(name), ImageFormat::Png)
            .unwrap();
    }

    #[test]
    fn generates_downscaled_thumbnail_and_reuses_it() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("A", "wide", "PNG");
        let dir = write_item(library.path(), &item);
        write_png(&dir, "wide.PNG", 1000, 500);

        let path = ensure_thumbnail(&dir, &item).unwrap().unwrap();
        assert_eq!(path, dir.join(THUMBNAIL_FILE));
        let (w, h) = image::open(&path).unwrap().dimensions();
        assert_eq!((w, h), (THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE / 2));

        let first = fs::metadata(&path).unwrap().modified().unwrap();
        ensure_thumbnail(&dir, &item).unwrap();
        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), first);
    }

    #[test]
    fn keeps_small_images_at_original_size() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("A", "small", "png");
        let dir = write_item(library.path(), &item);
        write_png(&dir, "small.png", 40, 30);

        let path = ensure_thumbnail(&dir, &item).unwrap().unwrap();
        assert_eq!(image::open(path).unwrap().dimensions(), (40, 30));
    }

    #[test]
    fn preview_serves_svg_as_is_and_skips_unsupported() {
        let library = tempfile::tempdir().unwrap();
        let svg = sample_item("S", "logo", "svg");
        let svg_dir = write_item(library.path(), &svg);
        assert_eq!(
            preview(&svg_dir).unwrap(),
            Some(Preview {
                path: svg_dir.join("logo.svg"),
                mime: "image/svg+xml"
            })
        );

        let pdf_dir = write_item(library.path(), &sample_item("P", "doc", "pdf"));
        assert_eq!(preview(&pdf_dir).unwrap(), None);
    }

    #[test]
    fn original_preview_serves_source_file_with_matching_mime() {
        let library = tempfile::tempdir().unwrap();
        let jpg = sample_item("J", "photo", "JPG");
        let jpg_dir = write_item(library.path(), &jpg);
        assert_eq!(
            original_preview(&jpg_dir).unwrap(),
            Some(Preview {
                path: jpg_dir.join("photo.JPG"),
                mime: "image/jpeg"
            })
        );

        let svg = sample_item("S", "logo", "svg");
        let svg_dir = write_item(library.path(), &svg);
        assert_eq!(
            original_preview(&svg_dir).unwrap(),
            Some(Preview {
                path: svg_dir.join("logo.svg"),
                mime: "image/svg+xml"
            })
        );

        let pdf_dir = write_item(library.path(), &sample_item("P", "doc", "pdf"));
        assert_eq!(original_preview(&pdf_dir).unwrap(), None);
    }

    #[test]
    fn corrupt_image_is_an_error() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("A", "broken", "png");
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("broken.png"), b"not an image").unwrap();

        assert!(ensure_thumbnail(&dir, &item).is_err());
        assert!(!dir.join(THUMBNAIL_FILE).exists());
    }

    #[test]
    fn only_item_dirs_are_accepted() {
        let library = tempfile::tempdir().unwrap();
        assert!(is_item_dir(&item::item_dir(library.path(), "A")));
        assert!(!is_item_dir(&library.path().join("images")));
        assert!(!is_item_dir(&library.path().join("other").join("A.info")));
        assert!(!is_item_dir(Path::new("images/A.info")));
    }

    #[test]
    fn read_within_item_dir_serves_regular_files() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("A", "photo", "png");
        let dir = write_item(library.path(), &item);
        let file = dir.join("photo.png");
        fs::write(&file, b"png-bytes").unwrap();

        assert_eq!(read_within_item_dir(&dir, &file).unwrap(), b"png-bytes");
    }

    #[cfg(unix)]
    #[test]
    fn read_within_item_dir_rejects_file_symlink() {
        let library = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let secret = outside.path().join("secret.txt");
        fs::write(&secret, b"top-secret").unwrap();

        let item = sample_item("A", "photo", "png");
        let dir = write_item(library.path(), &item);
        let link = dir.join("photo.png");
        std::os::unix::fs::symlink(&secret, &link).unwrap();

        let err = read_within_item_dir(&dir, &link).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::PermissionDenied);
    }

    #[cfg(unix)]
    #[test]
    fn read_within_item_dir_rejects_item_dir_symlink() {
        let library = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let real_dir = outside.path().join("payload");
        fs::create_dir_all(&real_dir).unwrap();
        let secret = real_dir.join("photo.png");
        fs::write(&secret, b"top-secret").unwrap();

        let images = library.path().join(IMAGES_DIR);
        fs::create_dir_all(&images).unwrap();
        let link_dir = images.join("A.info");
        std::os::unix::fs::symlink(&real_dir, &link_dir).unwrap();

        // Shape check would pass on the link path; read must still refuse.
        assert!(is_item_dir(&link_dir));
        let err = read_within_item_dir(&link_dir, &link_dir.join("photo.png")).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::PermissionDenied);
    }
}
