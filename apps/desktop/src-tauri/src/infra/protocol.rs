use crate::infra::diagnostic_log::{
    log_thumb_bad_request, log_thumb_forbidden, log_thumb_not_found, log_thumb_preview_error,
    log_thumb_range_outcome_once, log_thumb_read_error,
};
use crate::infra::http_range::{
    self, ByteRange, RangeParseResult, content_range_unsatisfiable, content_range_value,
};
use crate::infra::thumbnail;
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
    let range_header = request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned());
    tauri::async_runtime::spawn(async move {
        if full {
            let response = tauri::async_runtime::spawn_blocking(move || {
                respond(&encoded, full, range_header.as_deref())
            })
            .await
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
            responder.respond(response);
        } else {
            let _slot = DECODE_SLOTS.acquire().await;
            let response = tauri::async_runtime::spawn_blocking(move || {
                respond(&encoded, full, range_header.as_deref())
            })
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

fn respond(encoded: &str, full: bool, range_header: Option<&str>) -> Response<Vec<u8>> {
    let Ok(decoded) = percent_decode_str(encoded).decode_utf8() else {
        log_thumb_bad_request("invalid percent-encoding or utf-8", encoded, full);
        return status(StatusCode::BAD_REQUEST);
    };
    let item_dir = PathBuf::from(decoded.as_ref());
    if !thumbnail::is_item_dir(&item_dir) {
        log_thumb_forbidden(encoded, full, "path is not an item directory");
        return status(StatusCode::FORBIDDEN);
    }
    let preview = if full {
        thumbnail::original_preview(&item_dir)
    } else {
        thumbnail::preview(&item_dir)
    };
    let preview = match preview {
        Ok(Some(preview)) => preview,
        Ok(None) => {
            log_thumb_not_found(encoded, full);
            return status(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            log_thumb_preview_error(encoded, full, e.to_string());
            return status(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let file_len = match thumbnail::open_validated_preview_file(&item_dir, &preview.path) {
        Ok((_, len)) => len,
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            log_thumb_forbidden(encoded, full, "permission denied reading preview asset");
            return status(StatusCode::FORBIDDEN);
        }
        Err(e) => {
            log_thumb_read_error(encoded, full, e.to_string());
            return status(StatusCode::NOT_FOUND);
        }
    };

    if let Some(range_value) = range_header {
        return respond_with_range(
            encoded,
            full,
            range_value,
            file_len,
            &item_dir,
            &preview.path,
            preview.mime,
        );
    }

    match thumbnail::read_within_item_dir(&item_dir, &preview.path) {
        Ok(body) => ok_response(preview.mime, body, file_len, StatusCode::OK, None),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            log_thumb_forbidden(encoded, full, "permission denied reading preview asset");
            status(StatusCode::FORBIDDEN)
        }
        Err(e) => {
            log_thumb_read_error(encoded, full, e.to_string());
            status(StatusCode::NOT_FOUND)
        }
    }
}

fn respond_with_range(
    encoded: &str,
    full: bool,
    range_value: &str,
    file_len: u64,
    item_dir: &std::path::Path,
    path: &std::path::Path,
    mime: &str,
) -> Response<Vec<u8>> {
    match http_range::parse_bytes_range(range_value, file_len) {
        RangeParseResult::Satisfied(range) => {
            let range_label = format!("{}-{}", range.start, range.end_inclusive);
            match thumbnail::read_within_item_dir_range(
                item_dir,
                path,
                range.start,
                range.end_inclusive,
            ) {
                Ok(body) => {
                    log_thumb_range_outcome_once(encoded, full, 206, Some(&range_label));
                    ok_response(
                        mime,
                        body,
                        file_len,
                        StatusCode::PARTIAL_CONTENT,
                        Some(range),
                    )
                }
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                    log_thumb_forbidden(encoded, full, "permission denied reading preview asset");
                    status(StatusCode::FORBIDDEN)
                }
                Err(e) => {
                    log_thumb_read_error(encoded, full, e.to_string());
                    status(StatusCode::NOT_FOUND)
                }
            }
        }
        RangeParseResult::Unsatisfiable | RangeParseResult::Malformed => {
            log_thumb_range_outcome_once(encoded, full, 416, None);
            range_error_response(file_len)
        }
    }
}

fn ok_response(
    mime: &str,
    body: Vec<u8>,
    total_len: u64,
    status_code: StatusCode,
    byte_range: Option<ByteRange>,
) -> Response<Vec<u8>> {
    let content_len = body.len();
    let mut builder = Response::builder()
        .status(status_code)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, content_len.to_string())
        .header("Accept-Ranges", "bytes");
    if let Some(range) = byte_range {
        builder = builder.header("Content-Range", content_range_value(range, total_len));
    }
    builder
        .body(body)
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn range_error_response(total_len: u64) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header("Content-Range", content_range_unsatisfiable(total_len))
        .body(Vec::new())
        .unwrap_or_else(|_| status(StatusCode::RANGE_NOT_SATISFIABLE))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::item::tests::{sample_item, write_item};
    use crate::domain::library::IMAGES_DIR;
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

        let response = respond(&encode_dir(&svg_dir), false, None);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body().as_slice(), svg_body);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/svg+xml"
        );
        assert_eq!(response.headers().get("Accept-Ranges").unwrap(), "bytes");

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

        let response = respond(&encode_dir(&png_dir), true, None);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body().as_slice(), png_bytes);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
    }

    #[test]
    fn respond_range_partial_and_unsatisfiable() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("R", "clip", "mp4");
        let dir = write_item(library.path(), &item);
        let payload: Vec<u8> = (0u8..100).collect();
        fs::write(dir.join("clip.mp4"), &payload).unwrap();

        let encoded = encode_dir(&dir);

        let response = respond(&encoded, true, Some("bytes=0-9"));
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().as_slice(), &payload[0..10]);
        assert_eq!(
            response.headers().get("Content-Range").unwrap(),
            "bytes 0-9/100"
        );
        assert_eq!(
            response.headers().get(header::CONTENT_LENGTH).unwrap(),
            "10"
        );

        let response = respond(&encoded, true, Some("bytes=40-59"));
        assert_eq!(response.body().as_slice(), &payload[40..60]);
        assert_eq!(
            response.headers().get("Content-Range").unwrap(),
            "bytes 40-59/100"
        );

        let response = respond(&encoded, true, Some("bytes=-10"));
        assert_eq!(response.body().as_slice(), &payload[90..100]);

        let response = respond(&encoded, true, Some("bytes=50-"));
        assert_eq!(response.body().as_slice(), &payload[50..100]);

        let response = respond(&encoded, true, Some("bytes=150-200"));
        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(
            response.headers().get("Content-Range").unwrap(),
            "bytes */100"
        );
        assert!(response.body().is_empty());
    }

    #[test]
    fn respond_range_zero_length_file() {
        let library = tempfile::tempdir().unwrap();
        let item = sample_item("Z", "empty", "mp4");
        let dir = write_item(library.path(), &item);
        fs::write(dir.join("empty.mp4"), []).unwrap();
        let encoded = encode_dir(&dir);

        let response = respond(&encoded, true, None);
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.body().is_empty());

        let response = respond(&encoded, true, Some("bytes=0-"));
        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
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

        let response = respond(&encode_dir(&svg_dir), false, None);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty());

        let response = respond(&encode_dir(&svg_dir), true, None);
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

        let response = respond(&encode_dir(&link_dir), true, None);
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty());
    }
}
