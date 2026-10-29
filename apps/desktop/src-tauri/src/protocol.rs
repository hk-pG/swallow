use crate::thumbnail;
use percent_encoding::percent_decode_str;
use std::path::PathBuf;
use std::sync::LazyLock;
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};
use tokio::sync::Semaphore;

/// Must match the scheme passed to `convertFileSrc` in `apps/desktop/src/lib/thumbnail.ts`.
pub const THUMBNAIL_SCHEME: &str = "thumb";

/// Bounds concurrent decodes so scrolling through a large library does not exhaust memory.
static DECODE_SLOTS: LazyLock<Semaphore> =
    LazyLock::new(|| Semaphore::new(std::thread::available_parallelism().map_or(4, |n| n.get())));

/// `thumb://localhost/<percent-encoded item dir>[?full=1]` → item preview, generated on first access.
/// Passing `full=1` returns the original stored image without downscaling.
pub fn thumbnail(
    _ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let encoded = request.uri().path().trim_start_matches('/').to_owned();
    let full = is_full_query(request.uri().query());
    tauri::async_runtime::spawn(async move {
        if full {
            let response = tauri::async_runtime::spawn_blocking(move || respond(&encoded, true))
                .await
                .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
            responder.respond(response);
        } else {
            let _slot = DECODE_SLOTS.acquire().await;
            let response = tauri::async_runtime::spawn_blocking(move || respond(&encoded, false))
                .await
                .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
            responder.respond(response);
        }
    });
}

fn is_full_query(query: Option<&str>) -> bool {
    query
        .into_iter()
        .flat_map(|q| q.split('&'))
        .any(|pair| pair == "full=1")
}

fn respond(encoded: &str, full: bool) -> Response<Vec<u8>> {
    let Ok(decoded) = percent_decode_str(encoded).decode_utf8() else {
        return status(StatusCode::BAD_REQUEST);
    };
    let item_dir = PathBuf::from(decoded.as_ref());
    if !thumbnail::is_item_dir(&item_dir) {
        return status(StatusCode::FORBIDDEN);
    }
    let preview = if full {
        thumbnail::original_preview(&item_dir)
    } else {
        thumbnail::preview(&item_dir)
    };
    let preview = match preview {
        Ok(Some(preview)) => preview,
        Ok(None) => return status(StatusCode::NOT_FOUND),
        Err(e) => {
            eprintln!("thumbnail failed for {}: {e}", item_dir.display());
            return status(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    match thumbnail::read_within_item_dir(&item_dir, &preview.path) {
        Ok(body) => Response::builder()
            .header(header::CONTENT_TYPE, preview.mime)
            .body(body)
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR)),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => status(StatusCode::FORBIDDEN),
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::tests::{sample_item, write_item};
    use crate::library::IMAGES_DIR;
    use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
    use std::fs;

    fn encode_dir(dir: &std::path::Path) -> String {
        utf8_percent_encode(&dir.to_string_lossy(), NON_ALPHANUMERIC).to_string()
    }

    #[test]
    fn parses_full_query_parameter() {
        assert!(!is_full_query(None));
        assert!(!is_full_query(Some("")));
        assert!(!is_full_query(Some("full=0")));
        assert!(is_full_query(Some("full=1")));
        assert!(is_full_query(Some("v=2&full=1")));
    }

    #[test]
    fn respond_serves_real_svg_and_full_raster() {
        let library = tempfile::tempdir().unwrap();

        let svg = sample_item("S", "logo", "svg");
        let svg_dir = write_item(library.path(), &svg);
        let svg_body = b"<svg xmlns='http://www.w3.org/2000/svg'/>";
        fs::write(svg_dir.join("logo.svg"), svg_body).unwrap();

        let response = respond(&encode_dir(&svg_dir), false);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body().as_slice(), svg_body);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/svg+xml"
        );

        let png = sample_item("P", "photo", "png");
        let png_dir = write_item(library.path(), &png);
        // Minimal valid 1x1 PNG.
        let png_bytes: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE,
            0xD4, 0xEF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        fs::write(png_dir.join("photo.png"), png_bytes).unwrap();

        let response = respond(&encode_dir(&png_dir), true);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body().as_slice(), png_bytes);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
    }

    #[cfg(unix)]
    #[test]
    fn respond_rejects_asset_symlink_to_outside_file() {
        let library = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let secret = outside.path().join("secret.txt");
        fs::write(&secret, b"top-secret-content").unwrap();

        let svg = sample_item("S", "logo", "svg");
        let svg_dir = write_item(library.path(), &svg);
        std::os::unix::fs::symlink(&secret, svg_dir.join("logo.svg")).unwrap();

        let response = respond(&encode_dir(&svg_dir), false);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty());

        let response = respond(&encode_dir(&svg_dir), true);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn respond_rejects_item_dir_that_is_a_symlink() {
        let library = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let real_dir = outside.path().join("payload");
        fs::create_dir_all(&real_dir).unwrap();
        fs::write(
            real_dir.join("metadata.json"),
            serde_json::to_vec(&sample_item("S", "logo", "svg")).unwrap(),
        )
        .unwrap();
        fs::write(real_dir.join("logo.svg"), b"<svg/>").unwrap();

        let images = library.path().join(IMAGES_DIR);
        fs::create_dir_all(&images).unwrap();
        let link_dir = images.join("S.info");
        std::os::unix::fs::symlink(&real_dir, &link_dir).unwrap();

        let response = respond(&encode_dir(&link_dir), true);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty());
    }
}
