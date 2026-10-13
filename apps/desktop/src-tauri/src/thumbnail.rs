use crate::library::{self, IMAGES_DIR, ITEM_DIR_EXT, ItemMetadata};
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
    let source = library::item_file(item_dir, item)?;
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
    let item = library::read_item(item_dir)?;
    if item.ext.eq_ignore_ascii_case(SVG_EXT) {
        return Ok(Some(Preview {
            path: library::item_file(item_dir, &item)?,
            mime: "image/svg+xml",
        }));
    }
    Ok(ensure_thumbnail(item_dir, &item)?.map(|path| Preview {
        path,
        mime: "image/png",
    }))
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
    use crate::library::tests::{sample_item, write_item};
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
        assert!(is_item_dir(&library::item_dir(library.path(), "A")));
        assert!(!is_item_dir(&library.path().join("images")));
        assert!(!is_item_dir(&library.path().join("other").join("A.info")));
        assert!(!is_item_dir(Path::new("images/A.info")));
    }
}
