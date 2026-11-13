use std::sync::Mutex;

use crate::domain::library::LibraryInfo;

pub struct AppState {
    pub library: Mutex<Option<LibraryInfo>>,
    pub diagnostic_session_id: Mutex<String>,
}

impl AppState {
    pub fn new(diagnostic_session_id: String) -> Self {
        Self {
            library: Mutex::new(None),
            diagnostic_session_id: Mutex::new(diagnostic_session_id),
        }
    }
}
