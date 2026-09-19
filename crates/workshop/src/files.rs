use anyhow::{Result, bail};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

pub const MAX_LEVEL_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_WORKSHOP_ENTRIES: usize = 4_096;
const MAX_WORKSHOP_DEPTH: usize = 16;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkshopLevelFile {
    pub level_path: PathBuf,
    pub name: String,
    pub thumbnail_path: Option<PathBuf>,
}

pub async fn find_level_paths(directory: &Path) -> Result<Vec<PathBuf>> {
    let mut levels = Vec::new();
    let mut stack = vec![(directory.to_owned(), 0_usize)];
    let mut visited = 0_usize;
    while let Some((current, depth)) = stack.pop() {
        if depth > MAX_WORKSHOP_DEPTH {
            bail!("Workshop item directory nesting is too deep");
        }
        let mut entries = tokio::fs::read_dir(&current).await?;
        while let Some(entry) = entries.next_entry().await? {
            visited += 1;
            if visited > MAX_WORKSHOP_ENTRIES {
                bail!("Workshop item contains too many files");
            }
            let kind = entry.file_type().await?;
            if kind.is_dir() {
                stack.push((entry.path(), depth + 1));
            } else if kind.is_file()
                && entry
                    .path()
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("zeeplevel"))
            {
                levels.push(entry.path());
            }
        }
    }
    levels.sort();
    Ok(levels)
}

pub async fn discover_levels(directory: &Path) -> Result<Vec<WorkshopLevelFile>> {
    let paths = find_level_paths(directory).await?;
    if paths.is_empty() {
        bail!(
            "Workshop item contains no complete levels: {}",
            directory.display()
        );
    }
    let mut files_by_directory: HashMap<PathBuf, HashMap<String, PathBuf>> = HashMap::new();
    for path in &paths {
        let parent = path.parent().unwrap_or(directory).to_owned();
        if files_by_directory.contains_key(&parent) {
            continue;
        }
        let mut files = HashMap::new();
        let mut entries = tokio::fs::read_dir(&parent).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                files.insert(
                    entry.file_name().to_string_lossy().to_lowercase(),
                    entry.path(),
                );
            }
        }
        files_by_directory.insert(parent, files);
    }
    Ok(paths
        .into_iter()
        .map(|level_path| {
            let parent = level_path.parent().unwrap_or(directory);
            let name = level_path
                .file_stem()
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_default();
            let thumbnail = format!("{}_thumbnail.jpg", name.to_lowercase());
            let thumbnail_path = files_by_directory
                .get(parent)
                .and_then(|files| files.get(&thumbnail))
                .cloned();
            WorkshopLevelFile {
                level_path,
                name,
                thumbnail_path,
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn discovers_nested_levels_in_stable_order() -> Result<()> {
        let root =
            std::env::temp_dir().join(format!("zc-workshop-test-{}", zc_core::generate_uid()));
        tokio::fs::create_dir_all(root.join("nested")).await?;
        tokio::fs::write(root.join("b.ZEEPLEVEL"), "b").await?;
        tokio::fs::write(root.join("nested/a.zeeplevel"), "a").await?;
        tokio::fs::write(root.join("ignored.txt"), "x").await?;
        let paths = find_level_paths(&root).await?;
        assert_eq!(
            paths,
            vec![root.join("b.ZEEPLEVEL"), root.join("nested/a.zeeplevel")]
        );
        tokio::fs::remove_dir_all(root).await?;
        Ok(())
    }

    #[tokio::test]
    async fn matches_case_insensitive_sibling_thumbnail() -> Result<()> {
        let root =
            std::env::temp_dir().join(format!("zc-workshop-thumbnail-{}", zc_core::generate_uid()));
        tokio::fs::create_dir_all(&root).await?;
        tokio::fs::write(root.join("Track.ZEEPLEVEL"), "level").await?;
        tokio::fs::write(root.join("TRACK_THUMBNAIL.JPG"), "image").await?;
        let files = discover_levels(&root).await?;
        assert_eq!(files[0].name, "Track");
        assert_eq!(
            files[0].thumbnail_path,
            Some(root.join("TRACK_THUMBNAIL.JPG"))
        );
        tokio::fs::remove_dir_all(root).await?;
        Ok(())
    }
}
