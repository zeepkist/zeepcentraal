use anyhow::{Result, bail};
use std::path::{Path, PathBuf};

pub const MAX_LEVEL_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_WORKSHOP_ENTRIES: usize = 4_096;
const MAX_WORKSHOP_DEPTH: usize = 16;

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
}
