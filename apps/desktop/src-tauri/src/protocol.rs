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
    match std::fs::read(&preview.path) {
        Ok(body) => Response::builder()
            .header(header::CONTENT_TYPE, preview.mime)
            .body(body)
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR)),
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

    #[test]
    fn parses_full_query_parameter() {
        assert!(!is_full_query(None));
        assert!(!is_full_query(Some("")));
        assert!(!is_full_query(Some("full=0")));
        assert!(is_full_query(Some("full=1")));
        assert!(is_full_query(Some("v=2&full=1")));
    }
}
