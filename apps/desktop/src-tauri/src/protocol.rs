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

/// `thumb://localhost/<percent-encoded item dir>` → item preview, generated on first access.
pub fn thumbnail(
    _ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let encoded = request.uri().path().trim_start_matches('/').to_owned();
    tauri::async_runtime::spawn(async move {
        let _slot = DECODE_SLOTS.acquire().await;
        let response = tauri::async_runtime::spawn_blocking(move || respond(&encoded))
            .await
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
        responder.respond(response);
    });
}

fn respond(encoded: &str) -> Response<Vec<u8>> {
    let Ok(decoded) = percent_decode_str(encoded).decode_utf8() else {
        return status(StatusCode::BAD_REQUEST);
    };
    let item_dir = PathBuf::from(decoded.as_ref());
    if !thumbnail::is_item_dir(&item_dir) {
        return status(StatusCode::FORBIDDEN);
    }
    let preview = match thumbnail::preview(&item_dir) {
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
