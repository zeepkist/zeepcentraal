use anyhow::{Context, Result, ensure};
use std::{collections::BTreeSet, fs, path::Path};

fn fields(row: &str) -> Result<Vec<String>> {
    let mut result = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut characters = row.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '"' if quoted && characters.peek() == Some(&'"') => {
                field.push('"');
                characters.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => result.push(std::mem::take(&mut field)),
            _ => field.push(character),
        }
    }
    ensure!(!quoted, "Unclosed adventure CSV quote");
    result.push(field);
    Ok(result)
}

fn sql_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Generate Diesel backfill SQL without opening a database or altering source levels.
pub fn generate(root: &Path) -> Result<(String, usize)> {
    let map = fs::read_to_string(root.join("map.csv"))?;
    let mut rows = map.trim_start_matches('\u{feff}').lines();
    let header = fields(rows.next().context("Adventure map is empty")?)?;
    let uid_column = header
        .iter()
        .position(|value| value == "Hash")
        .context("Missing Hash column")?;
    let name_column = header
        .iter()
        .position(|value| value == "Level Name")
        .context("Missing Level Name column")?;
    let mut values = Vec::new();
    let mut hashes = BTreeSet::new();
    for row in rows.filter(|row| !row.trim().is_empty()) {
        let columns = fields(row)?;
        let uid = columns.get(uid_column).context("Missing adventure UID")?;
        let name = columns.get(name_column).context("Missing adventure name")?;
        ensure!(
            !uid.is_empty() && name.starts_with("Level ") && !name.contains(['/', '\\']),
            "Invalid adventure map row"
        );
        let series = name
            .strip_prefix("Level ")
            .unwrap()
            .split('-')
            .next()
            .unwrap();
        let source = fs::read_to_string(root.join(series).join(format!("{name}.zeeplevel")))?;
        let parsed = zc_core::levels::parse_level(&source, true, 0)?;
        ensure!(
            hashes.insert(parsed.hash.clone()),
            "Duplicate adventure hash"
        );
        let environment = serde_json::to_string(&parsed.environment)?;
        // Replace from right to left so escaped values cannot shadow a marker.
        values.push(
            include_str!("queries/adventure_environment/environment_value.sql")
                .trim_end()
                .replacen("{{environment}}", &sql_string(&environment), 1)
                .replacen("{{uid}}", &sql_string(uid), 1)
                .replacen("{{hash}}", &sql_string(&parsed.hash), 1),
        );
    }
    ensure!(!values.is_empty(), "No adventure levels found");
    let count = values.len();
    Ok((
        include_str!("queries/adventure_environment/backfill_environment.sql")
            .replace("\r\n", "\n")
            .replace("{{values}}", &values.join(",\n")),
        count,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backfills_source_environments_only() -> Result<()> {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/adventureLevels");
        let (sql, count) = generate(&root)?;
        assert_eq!(count, 120);
        assert!(sql.contains("skyboxOverride"));
        assert!(sql.contains("IS DISTINCT FROM"));
        assert!(!sql.contains("SET \"xx_hash\""));
        assert!(!sql.contains("SET \"blocks\""));
        Ok(())
    }
}
