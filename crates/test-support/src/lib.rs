use anyhow::{Context, Result};

pub fn json_fixture(path: impl AsRef<std::path::Path>) -> Result<serde_json::Value> {
    let path = path.as_ref();
    let bytes = std::fs::read(path)
        .with_context(|| format!("Failed to read fixture {}", path.display()))?;
    Ok(serde_json::from_slice(&bytes)?)
}
