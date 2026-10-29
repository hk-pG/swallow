use std::io::{self, Read};
use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;

use percent_encoding::percent_decode_str;
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::commands::{self, AppInfo, AppState};
use crate::import::{self, BytesImport, ImportError};
use crate::item::ItemMetadata;

/// Mirrors `DEFAULT_API_PORT` in `packages/shared/src/api.ts`.
pub const DEFAULT_API_PORT: u16 = 41600;
/// Mirrors `ITEMS_IMPORTED_EVENT` in `apps/desktop/src/lib/commands.ts`.
pub const ITEMS_IMPORTED_EVENT: &str = "items-imported";

/// Mirrors `API_PATHS` in `packages/shared/src/api.ts`.
const APP_INFO_PATH: &str = "/api/app/info";
const ADD_ITEM_PATH: &str = "/api/items";

const MAX_BODY_BYTES: u64 = 256 * 1024 * 1024;
const MAX_NAME_CHARS: usize = 200;
const DEFAULT_NAME: &str = "image";
const ALLOWED_HOSTS: &[&str] = &["127.0.0.1", "localhost", "[::1]"];
const ALLOWED_ORIGIN_PREFIX: &str = "chrome-extension://";

/// What the API needs from the running app.
pub trait Context {
    fn app_info(&self) -> AppInfo;
    /// Root of the open library, if any.
    fn library(&self) -> Option<PathBuf>;
    fn items_imported(&self, item: &ItemMetadata);
}

impl Context for tauri::AppHandle {
    fn app_info(&self) -> AppInfo {
        commands::app_info(self.clone())
    }

    fn library(&self) -> Option<PathBuf> {
        let state = self.state::<AppState>();
        let library = state.library.lock().unwrap();
        library.as_ref().map(|library| PathBuf::from(&library.path))
    }

    fn items_imported(&self, item: &ItemMetadata) {
        if let Err(e) = self.emit(ITEMS_IMPORTED_EVENT, item) {
            eprintln!("failed to emit {ITEMS_IMPORTED_EVENT}: {e}");
        }
    }
}

/// Serves the API on `127.0.0.1:DEFAULT_API_PORT` in the background. The app keeps running
/// without it if the port is taken.
pub fn start(app: tauri::AppHandle) {
    match tiny_http::Server::http((Ipv4Addr::LOCALHOST, DEFAULT_API_PORT)) {
        Ok(server) => {
            std::thread::spawn(move || serve(&server, &app));
        }
        Err(e) => eprintln!("local HTTP API disabled: cannot bind port {DEFAULT_API_PORT}: {e}"),
    }
}

fn serve<C: Context + Clone + Send + 'static>(server: &tiny_http::Server, ctx: &C) {
    for request in server.incoming_requests() {
        let ctx = ctx.clone();
        std::thread::spawn(move || respond(request, &ctx));
    }
}

fn respond(mut request: tiny_http::Request, ctx: &impl Context) {
    let header = |name: &'static str| {
        request
            .headers()
            .iter()
            .find(|h| h.field.equiv(name))
            .map(|h| h.value.as_str().to_owned())
    };
    let (host, origin, content_type) = (header("Host"), header("Origin"), header("Content-Type"));
    let method = request.method().as_str().to_owned();
    let url = request.url().to_owned();
    let head = RequestHead {
        method: &method,
        url: &url,
        peer: request.remote_addr().copied(),
        host: host.as_deref(),
        origin: origin.as_deref(),
        content_type: content_type.as_deref(),
        content_length: request.body_length().map(|len| len as u64),
    };
    let response = handle(&head, request.as_reader(), ctx);
    let json = tiny_http::Header::from_bytes("Content-Type", "application/json; charset=utf-8")
        .expect("static header is valid");
    let reply = tiny_http::Response::from_data(response.body)
        .with_status_code(response.status)
        .with_header(json);
    if let Err(e) = request.respond(reply) {
        eprintln!("local HTTP API: failed to respond: {e}");
    }
}

#[derive(Debug)]
pub struct RequestHead<'a> {
    pub method: &'a str,
    /// Path and query, e.g. `/api/items?name=a`
    pub url: &'a str,
    pub peer: Option<SocketAddr>,
    pub host: Option<&'a str>,
    pub origin: Option<&'a str>,
    pub content_type: Option<&'a str>,
    pub content_length: Option<u64>,
}

#[derive(Debug)]
pub struct ApiResponse {
    pub status: u16,
    /// JSON
    pub body: Vec<u8>,
}

impl ApiResponse {
    fn json(status: u16, value: &impl Serialize) -> Self {
        match serde_json::to_vec(value) {
            Ok(body) => Self { status, body },
            Err(e) => ApiError::new(ApiErrorCode::Internal, e.to_string()).into(),
        }
    }
}

/// Mirrors `ApiErrorCode` in `packages/shared/src/api.ts`.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApiErrorCode {
    BadRequest,
    Forbidden,
    NotFound,
    MethodNotAllowed,
    PayloadTooLarge,
    UnsupportedExtension,
    LibraryNotOpen,
    Internal,
}

impl ApiErrorCode {
    fn status(self) -> u16 {
        match self {
            Self::BadRequest => 400,
            Self::Forbidden => 403,
            Self::NotFound => 404,
            Self::MethodNotAllowed => 405,
            Self::PayloadTooLarge => 413,
            Self::UnsupportedExtension => 415,
            Self::LibraryNotOpen => 503,
            Self::Internal => 500,
        }
    }
}

/// Mirrors `ApiError` in `packages/shared/src/api.ts`.
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: ApiErrorCode,
    pub message: String,
}

impl ApiError {
    fn new(code: ApiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<ApiError> for ApiResponse {
    fn from(error: ApiError) -> Self {
        let status = error.code.status();
        let body = serde_json::to_vec(&error).unwrap_or_default();
        Self { status, body }
    }
}

impl From<ImportError> for ApiError {
    fn from(error: ImportError) -> Self {
        let code = match error {
            ImportError::NotALibrary(_) => ApiErrorCode::LibraryNotOpen,
            ImportError::UnsupportedExtension(_) => ApiErrorCode::UnsupportedExtension,
            ImportError::Folder(_) => ApiErrorCode::Internal,
            ImportError::Io(_) => ApiErrorCode::Internal,
        };
        Self::new(code, error.to_string())
    }
}

/// Routes one request. `body` is read only after the request passes the access checks.
pub fn handle(head: &RequestHead<'_>, body: &mut dyn Read, ctx: &impl Context) -> ApiResponse {
    let result = check_access(head).and_then(|()| {
        let (path, query) = head.url.split_once('?').unwrap_or((head.url, ""));
        match (path, head.method) {
            (APP_INFO_PATH, "GET") => Ok(ApiResponse::json(200, &ctx.app_info())),
            (ADD_ITEM_PATH, "POST") => add_item(head, query, body, ctx),
            (APP_INFO_PATH | ADD_ITEM_PATH, _) => Err(ApiError::new(
                ApiErrorCode::MethodNotAllowed,
                format!("{} {path} には対応していません", head.method),
            )),
            _ => Err(ApiError::new(
                ApiErrorCode::NotFound,
                format!("{path} は存在しません"),
            )),
        }
    });
    result.unwrap_or_else(ApiResponse::from)
}

/// Binding to 127.0.0.1 already keeps other machines out. The `Host` check stops DNS
/// rebinding, and requiring a `chrome-extension://` `Origin` stops ordinary web pages
/// and non-browser local clients from using the API.
fn check_access(head: &RequestHead<'_>) -> Result<(), ApiError> {
    let forbidden = |message: &str| Err(ApiError::new(ApiErrorCode::Forbidden, message));
    if !head.peer.is_some_and(|peer| peer.ip().is_loopback()) {
        return forbidden("localhost 以外からの接続は受け付けません");
    }
    if !head.host.is_some_and(is_allowed_host) {
        return forbidden("Host が localhost ではありません");
    }
    match head.origin {
        Some(origin) if origin.starts_with(ALLOWED_ORIGIN_PREFIX) => Ok(()),
        _ => forbidden("この Origin からのリクエストは受け付けません"),
    }
}

fn is_allowed_host(host: &str) -> bool {
    let name = match host.rsplit_once(':') {
        Some((name, port)) if !port.contains(']') => name,
        _ => host,
    };
    ALLOWED_HOSTS
        .iter()
        .any(|allowed| name.eq_ignore_ascii_case(allowed))
}

fn add_item(
    head: &RequestHead<'_>,
    query: &str,
    body: &mut dyn Read,
    ctx: &impl Context,
) -> Result<ApiResponse, ApiError> {
    let Some(library) = ctx.library() else {
        return Err(ApiError::new(
            ApiErrorCode::LibraryNotOpen,
            "ライブラリが開かれていません",
        ));
    };
    let ext = query_param(query, "ext")
        .map(|ext| ext.trim().trim_start_matches('.').to_lowercase())
        .filter(|ext| !ext.is_empty())
        .or_else(|| {
            head.content_type
                .and_then(ext_from_content_type)
                .map(str::to_owned)
        })
        .ok_or_else(|| {
            ApiError::new(
                ApiErrorCode::BadRequest,
                "ext か画像の Content-Type を指定してください",
            )
        })?;
    let name = sanitize_name(query_param(query, "name").as_deref());
    let url = query_param(query, "url")
        .map(|url| url.trim().to_owned())
        .filter(|url| !url.is_empty());
    let bytes = read_body(head.content_length, body)?;

    let item = import::import_bytes(
        &library,
        &BytesImport {
            name: &name,
            ext: &ext,
            url: url.as_deref(),
            bytes: &bytes,
        },
    )?;
    ctx.items_imported(&item);
    Ok(ApiResponse::json(201, &item))
}

fn read_body(content_length: Option<u64>, body: &mut dyn Read) -> Result<Vec<u8>, ApiError> {
    let too_large = || {
        ApiError::new(
            ApiErrorCode::PayloadTooLarge,
            format!("本文は {MAX_BODY_BYTES} バイト以下にしてください"),
        )
    };
    if content_length.is_some_and(|len| len > MAX_BODY_BYTES) {
        return Err(too_large());
    }
    let mut bytes = Vec::new();
    body.take(MAX_BODY_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e: io::Error| ApiError::new(ApiErrorCode::BadRequest, e.to_string()))?;
    if bytes.len() as u64 > MAX_BODY_BYTES {
        return Err(too_large());
    }
    if bytes.is_empty() {
        return Err(ApiError::new(ApiErrorCode::BadRequest, "本文が空です"));
    }
    Ok(bytes)
}

/// Decodes an `application/x-www-form-urlencoded` value, as produced by `URLSearchParams`.
fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        (k == key).then(|| {
            percent_decode_str(&v.replace('+', " "))
                .decode_utf8_lossy()
                .into_owned()
        })
    })
}

fn ext_from_content_type(content_type: &str) -> Option<&'static str> {
    let mime = content_type.split(';').next()?.trim().to_ascii_lowercase();
    Some(match mime.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/svg+xml" => "svg",
        "application/pdf" => "pdf",
        _ => return None,
    })
}

/// Makes `raw` usable as a file stem on every OS, see `item::item_file`.
fn sanitize_name(raw: Option<&str>) -> String {
    let replaced: String = raw
        .unwrap_or_default()
        .chars()
        .map(|c| {
            if c.is_control() || r#"/\:*?"<>|"#.contains(c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    let truncated: String = replaced.trim().chars().take(MAX_NAME_CHARS).collect();
    let name = truncated.trim().trim_end_matches('.');
    if name.is_empty() {
        DEFAULT_NAME.to_owned()
    } else {
        name.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::fs;
    use std::io::Write;
    use std::net::TcpStream;
    use std::path::Path;

    use crate::library::IMAGES_DIR;

    #[derive(Default)]
    struct TestContext {
        library: Option<PathBuf>,
        imported: RefCell<Vec<String>>,
    }

    impl TestContext {
        fn with_library(path: &Path) -> Self {
            Self {
                library: Some(path.to_owned()),
                ..Self::default()
            }
        }
    }

    impl Context for TestContext {
        fn app_info(&self) -> AppInfo {
            AppInfo {
                name: "Swallow".into(),
                version: "0.1.0".into(),
            }
        }

        fn library(&self) -> Option<PathBuf> {
            self.library.clone()
        }

        fn items_imported(&self, item: &ItemMetadata) {
            self.imported.borrow_mut().push(item.id.clone());
        }
    }

    fn library() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join(IMAGES_DIR)).unwrap();
        dir
    }

    fn png(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        bytes.extend_from_slice(&width.to_be_bytes());
        bytes.extend_from_slice(&height.to_be_bytes());
        bytes.extend_from_slice(&[8, 6, 0, 0, 0, 0, 0, 0, 0]);
        bytes
    }

    fn head<'a>(method: &'a str, url: &'a str) -> RequestHead<'a> {
        RequestHead {
            method,
            url,
            peer: Some(SocketAddr::from((Ipv4Addr::LOCALHOST, 50000))),
            host: Some("127.0.0.1:41600"),
            origin: Some("chrome-extension://abcdefghijklmnop"),
            content_type: None,
            content_length: None,
        }
    }

    fn call(head: &RequestHead<'_>, body: &[u8], ctx: &TestContext) -> (u16, serde_json::Value) {
        let response = handle(head, &mut &body[..], ctx);
        let json = serde_json::from_slice(&response.body).unwrap();
        (response.status, json)
    }

    fn error_code(json: &serde_json::Value) -> &str {
        json["code"].as_str().unwrap()
    }

    #[test]
    fn app_info_returns_shared_shape() {
        let (status, json) = call(&head("GET", "/api/app/info"), b"", &TestContext::default());
        assert_eq!(status, 200);
        assert_eq!(
            json,
            serde_json::json!({ "name": "Swallow", "version": "0.1.0" })
        );
    }

    #[test]
    fn add_item_stores_body_with_query_metadata() {
        let lib = library();
        let ctx = TestContext::with_library(lib.path());
        let url = "/api/items?name=sunset+photo&url=https%3A%2F%2Fexample.com%2F%3Fq%3D1%26r%3D2";
        let head = RequestHead {
            content_type: Some("image/png"),
            ..head("POST", url)
        };

        let (status, json) = call(&head, &png(4, 3), &ctx);

        assert_eq!(status, 201);
        let item: ItemMetadata = serde_json::from_value(json).unwrap();
        assert_eq!(
            (item.name.as_str(), item.ext.as_str()),
            ("sunset photo", "png")
        );
        assert_eq!((item.width, item.height), (Some(4), Some(3)));
        assert_eq!(item.url.as_deref(), Some("https://example.com/?q=1&r=2"));
        assert_eq!(*ctx.imported.borrow(), std::slice::from_ref(&item.id));
        let dir = crate::item::item_dir(lib.path(), &item.id);
        assert_eq!(fs::read(dir.join("sunset photo.png")).unwrap(), png(4, 3));
    }

    #[test]
    fn add_item_prefers_ext_param_and_defaults_name() {
        let lib = library();
        let ctx = TestContext::with_library(lib.path());
        let head = RequestHead {
            content_type: Some("application/octet-stream"),
            ..head("POST", "/api/items?ext=.WEBP")
        };
        let (status, json) = call(&head, b"not really webp", &ctx);
        assert_eq!(status, 201);
        assert_eq!(
            (json["name"].as_str(), json["ext"].as_str()),
            (Some("image"), Some("webp"))
        );
    }

    #[test]
    fn add_item_without_library_is_rejected_before_reading_body() {
        let ctx = TestContext::default();
        let mut body = io::Cursor::new(png(1, 1));
        let response = handle(
            &RequestHead {
                content_type: Some("image/png"),
                ..head("POST", "/api/items")
            },
            &mut body,
            &ctx,
        );
        assert_eq!(response.status, 503);
        let json: serde_json::Value = serde_json::from_slice(&response.body).unwrap();
        assert_eq!(error_code(&json), "libraryNotOpen");
        assert_eq!(body.position(), 0);
    }

    #[test]
    fn add_item_validates_input() {
        let lib = library();
        let ctx = TestContext::with_library(lib.path());
        let cases: [(RequestHead<'_>, &[u8], u16, &str); 4] = [
            (head("POST", "/api/items"), b"x", 400, "badRequest"),
            (head("POST", "/api/items?ext=png"), b"", 400, "badRequest"),
            (
                head("POST", "/api/items?ext=exe"),
                b"x",
                415,
                "unsupportedExtension",
            ),
            (
                RequestHead {
                    content_length: Some(MAX_BODY_BYTES + 1),
                    ..head("POST", "/api/items?ext=png")
                },
                b"x",
                413,
                "payloadTooLarge",
            ),
        ];
        for (head, body, status, code) in cases {
            let (actual, json) = call(&head, body, &ctx);
            assert_eq!((actual, error_code(&json)), (status, code), "{head:?}");
        }
        assert!(ctx.imported.borrow().is_empty());
        assert_eq!(
            fs::read_dir(lib.path().join(IMAGES_DIR)).unwrap().count(),
            0
        );
    }

    #[test]
    fn unknown_routes_and_methods() {
        let ctx = TestContext::default();
        let (status, json) = call(&head("GET", "/api/nope"), b"", &ctx);
        assert_eq!((status, error_code(&json)), (404, "notFound"));
        let (status, json) = call(&head("POST", "/api/app/info"), b"", &ctx);
        assert_eq!((status, error_code(&json)), (405, "methodNotAllowed"));
        let (status, _) = call(&head("GET", "/api/items"), b"", &ctx);
        assert_eq!(status, 405);
    }

    #[test]
    fn rejects_non_local_requests() {
        let ctx = TestContext::default();
        let remote = RequestHead {
            peer: Some(SocketAddr::from(([192, 168, 0, 2], 50000))),
            ..head("GET", "/api/app/info")
        };
        let unknown_peer = RequestHead {
            peer: None,
            ..head("GET", "/api/app/info")
        };
        let rebound = RequestHead {
            host: Some("evil.example:41600"),
            ..head("GET", "/api/app/info")
        };
        let no_host = RequestHead {
            host: None,
            ..head("GET", "/api/app/info")
        };
        let web_page = RequestHead {
            origin: Some("https://evil.example"),
            ..head("GET", "/api/app/info")
        };
        let no_origin = RequestHead {
            origin: None,
            ..head("GET", "/api/app/info")
        };
        let empty_origin = RequestHead {
            origin: Some(""),
            ..head("GET", "/api/app/info")
        };
        for head in [
            remote,
            unknown_peer,
            rebound,
            no_host,
            web_page,
            no_origin,
            empty_origin,
        ] {
            let (status, json) = call(&head, b"", &ctx);
            assert_eq!((status, error_code(&json)), (403, "forbidden"), "{head:?}");
        }
    }

    #[test]
    fn add_item_without_origin_does_not_write_library() {
        let lib = library();
        let ctx = TestContext::with_library(lib.path());
        let head = RequestHead {
            origin: None,
            content_type: Some("image/png"),
            ..head("POST", "/api/items?ext=png")
        };
        let (status, json) = call(&head, &png(1, 1), &ctx);
        assert_eq!((status, error_code(&json)), (403, "forbidden"));
        assert!(ctx.imported.borrow().is_empty());
        assert_eq!(
            fs::read_dir(lib.path().join(IMAGES_DIR)).unwrap().count(),
            0
        );
    }

    #[test]
    fn accepts_local_hosts_and_extension_origin() {
        let ctx = TestContext::default();
        for host in [
            "localhost:41600",
            "LOCALHOST",
            "127.0.0.1",
            "[::1]:41600",
            "[::1]",
        ] {
            let head = RequestHead {
                host: Some(host),
                origin: Some("chrome-extension://abcdefghijklmnop"),
                ..head("GET", "/api/app/info")
            };
            assert_eq!(call(&head, b"", &ctx).0, 200, "{host}");
        }
    }

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize_name(Some("  cat  ")), "cat");
        assert_eq!(sanitize_name(Some("../a/b\\c:d")), ".._a_b_c_d");
        assert_eq!(sanitize_name(Some("line\nbreak")), "line_break");
        assert_eq!(sanitize_name(Some("..")), DEFAULT_NAME);
        assert_eq!(sanitize_name(Some("   ")), DEFAULT_NAME);
        assert_eq!(sanitize_name(None), DEFAULT_NAME);
        assert_eq!(
            sanitize_name(Some(&"あ".repeat(500))).chars().count(),
            MAX_NAME_CHARS
        );
    }

    #[test]
    fn infers_ext_from_content_type() {
        assert_eq!(ext_from_content_type("image/JPEG; charset=x"), Some("jpg"));
        assert_eq!(ext_from_content_type("image/svg+xml"), Some("svg"));
        assert_eq!(ext_from_content_type("text/html"), None);
    }

    #[derive(Clone)]
    struct NoLibrary;

    impl Context for NoLibrary {
        fn app_info(&self) -> AppInfo {
            TestContext::default().app_info()
        }

        fn library(&self) -> Option<PathBuf> {
            None
        }

        fn items_imported(&self, _: &ItemMetadata) {}
    }

    #[test]
    fn serves_over_tcp() {
        let server = tiny_http::Server::http((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let addr = server.server_addr().to_ip().unwrap();
        let ctx = NoLibrary;
        std::thread::spawn(move || serve(&server, &ctx));

        let mut stream = TcpStream::connect(addr).unwrap();
        write!(
            stream,
            "GET /api/app/info HTTP/1.1\r\nHost: localhost:{}\r\nOrigin: chrome-extension://abcdefghijklmnop\r\nConnection: close\r\n\r\n",
            addr.port()
        )
        .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();

        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        assert!(response.contains("application/json"), "{response}");
        assert!(
            response.ends_with(r#"{"name":"Swallow","version":"0.1.0"}"#),
            "{response}"
        );
    }
}
