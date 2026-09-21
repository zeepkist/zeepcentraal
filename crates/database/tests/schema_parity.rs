use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

#[derive(Deserialize)]
struct Snapshot {
    tables: BTreeMap<String, Table>,
    views: BTreeMap<String, View>,
}

#[derive(Deserialize)]
struct Table {
    columns: BTreeMap<String, Column>,
}

#[derive(Deserialize)]
struct View {
    columns: BTreeMap<String, Column>,
}

#[derive(Deserialize)]
struct Column {
    name: String,
}

#[test]
fn generated_schema_covers_latest_drizzle_snapshot() -> anyhow::Result<()> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let snapshot_bytes =
        std::fs::read(root.join("packages/database/drizzle/meta/0086_snapshot.json"))?;
    let snapshot: Snapshot = serde_json::from_slice(&snapshot_bytes)?;
    let generated = std::fs::read_to_string(root.join("crates/database/src/schema.rs"))?;

    assert_eq!(snapshot.tables.len(), 53);
    assert_eq!(snapshot.views.len(), 1);
    let expected_columns = snapshot
        .tables
        .values()
        .map(|table| table.columns.len())
        .sum::<usize>()
        + snapshot
            .views
            .values()
            .map(|view| view.columns.len())
            .sum::<usize>();
    assert_eq!(expected_columns, 535);
    assert_eq!(
        zc_database::schema::DRIZZLE_TABLE_COUNT,
        snapshot.tables.len()
    );
    assert_eq!(
        zc_database::schema::DRIZZLE_VIEW_COUNT,
        snapshot.views.len()
    );
    assert_eq!(zc_database::schema::DRIZZLE_COLUMN_COUNT, expected_columns);
    assert_eq!(
        zc_database::schema::DRIZZLE_SNAPSHOT_SHA256,
        format!("{:x}", Sha256::digest(&snapshot_bytes))
    );

    for (qualified_name, table) in snapshot.tables {
        let table_name = qualified_name.rsplit('.').next().unwrap();
        assert!(
            generated.contains(&format!(".{table_name} ("))
                || generated.contains(&format!("    {table_name} ("))
                || generated.contains(&format!("#[sql_name = \"{table_name}\"]")),
            "missing table {qualified_name}"
        );
        for column in table.columns.values() {
            assert!(
                generated.contains(&format!("        {} ->", rust_name(&column.name))),
                "missing {qualified_name}.{}",
                column.name
            );
        }
    }
    for (qualified_name, view) in snapshot.views {
        let view_name = qualified_name.rsplit('.').next().unwrap();
        assert!(
            generated.contains(&format!(".{view_name} ("))
                || generated.contains(&format!("    {view_name} (")),
            "missing view {qualified_name}"
        );
        for column in view.columns.values() {
            assert!(
                generated.contains(&format!("        {} ->", rust_name(&column.name))),
                "missing {qualified_name}.{}",
                column.name
            );
        }
    }
    Ok(())
}

fn rust_name(name: &str) -> String {
    match name {
        "as" | "async" | "await" | "break" | "const" | "continue" | "crate" | "dyn" | "else"
        | "enum" | "extern" | "false" | "fn" | "for" | "if" | "impl" | "in" | "let" | "loop"
        | "match" | "mod" | "move" | "mut" | "pub" | "ref" | "return" | "self" | "Self"
        | "static" | "struct" | "super" | "trait" | "true" | "type" | "union" | "unsafe"
        | "use" | "where" | "while" | "abstract" | "become" | "box" | "do" | "final" | "macro"
        | "override" | "priv" | "typeof" | "unsized" | "virtual" | "yield" | "try" => {
            format!("r#{name}")
        }
        _ => name.to_owned(),
    }
}
