use std::sync::Mutex;

use crate::domain::library::LibraryInfo;

#[derive(Default)]
pub struct AppState {
    pub library: Mutex<Option<LibraryInfo>>,
}
