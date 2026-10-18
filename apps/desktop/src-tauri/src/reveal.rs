use std::path::Path;
use std::process::Command;

pub fn reveal_in_file_manager(path: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = path.parent().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "item path has no parent directory")
        })?;
        Command::new("xdg-open").arg(parent).spawn()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn reveal_accepts_existing_file_path() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("sample.png");
        std::fs::write(&file, b"x").unwrap();
        reveal_in_file_manager(&file).expect("spawn should succeed in CI");
    }

    #[test]
    fn reveal_rejects_path_without_parent() {
        let err = reveal_in_file_manager(Path::new("file-only")).unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::NotFound);
    }
}
