use anyhow::{Context, Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Text},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Deserialize)]
struct Snapshot {
    tables: BTreeMap<String, Object>,
    views: BTreeMap<String, Object>,
}

#[derive(Deserialize)]
struct Object {
    columns: BTreeMap<String, SnapshotColumn>,
}

#[derive(Deserialize)]
struct SnapshotColumn {
    name: String,
    #[serde(rename = "type")]
    data_type: String,
    #[serde(rename = "notNull")]
    not_null: bool,
}

#[derive(Debug, QueryableByName)]
struct CatalogColumn {
    #[diesel(sql_type = Text)]
    table_schema: String,
    #[diesel(sql_type = Text)]
    table_name: String,
    #[diesel(sql_type = Text)]
    column_name: String,
    #[diesel(sql_type = Text)]
    data_type: String,
    #[diesel(sql_type = Bool)]
    not_null: bool,
    #[diesel(sql_type = Text)]
    relation_kind: String,
}

pub async fn verify(connection: &mut AsyncPgConnection) -> Result<()> {
    let snapshot: Snapshot = serde_json::from_str(include_str!(
        "../../../packages/database/drizzle/meta/0086_snapshot.json"
    ))?;
    let rows: Vec<CatalogColumn> = sql_query(
        "SELECT n.nspname::text AS table_schema, c.relname::text AS table_name, \
         a.attname::text AS column_name, format_type(a.atttypid,a.atttypmod)::text AS data_type, \
         a.attnotnull AS not_null, c.relkind::text AS relation_kind \
         FROM pg_catalog.pg_attribute a \
         JOIN pg_catalog.pg_class c ON c.oid=a.attrelid \
         JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace \
         WHERE n.nspname IN ('public','zc_private') AND c.relkind IN ('r','p','v','m') \
         AND a.attnum > 0 AND NOT a.attisdropped",
    )
    .load(connection)
    .await
    .context("Failed to inspect PostgreSQL catalog")?;
    let actual: BTreeMap<_, _> = rows
        .into_iter()
        .map(|column| {
            (
                format!(
                    "{}.{}.{}",
                    column.table_schema, column.table_name, column.column_name
                ),
                column,
            )
        })
        .collect();

    for (qualified_name, object) in &snapshot.tables {
        verify_object(qualified_name, object, false, &actual)?;
    }
    for (qualified_name, object) in &snapshot.views {
        verify_object(qualified_name, object, true, &actual)?;
    }
    Ok(())
}

fn verify_object(
    qualified_name: &str,
    object: &Object,
    view: bool,
    actual: &BTreeMap<String, CatalogColumn>,
) -> Result<()> {
    let (schema, table) = qualified_name
        .split_once('.')
        .context("Drizzle snapshot object lacks schema")?;
    for expected in object.columns.values() {
        let key = format!("{schema}.{table}.{}", expected.name);
        let column = actual
            .get(&key)
            .with_context(|| format!("PostgreSQL catalog is missing {key}"))?;
        ensure!(
            column.data_type == normalize_type(&expected.data_type),
            "PostgreSQL type differs for {key}: expected {}, found {}",
            normalize_type(&expected.data_type),
            column.data_type
        );
        if !view {
            ensure!(
                column.not_null == expected.not_null,
                "PostgreSQL nullability differs for {key}"
            );
            ensure!(
                matches!(column.relation_kind.as_str(), "r" | "p"),
                "PostgreSQL object {schema}.{table} is not a table"
            );
        } else {
            ensure!(
                matches!(column.relation_kind.as_str(), "v" | "m"),
                "PostgreSQL object {schema}.{table} is not a view"
            );
        }
    }
    Ok(())
}

fn normalize_type(value: &str) -> String {
    match value {
        "varchar" => "character varying".to_owned(),
        value if value.starts_with("varchar(") => value.replacen("varchar", "character varying", 1),
        _ => value.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn drizzle_varchar_names_match_pg_catalog() {
        assert_eq!(super::normalize_type("varchar"), "character varying");
        assert_eq!(
            super::normalize_type("varchar(255)"),
            "character varying(255)"
        );
        assert_eq!(super::normalize_type("integer[]"), "integer[]");
    }
}
