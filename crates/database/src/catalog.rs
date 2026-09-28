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
    let mut snapshot: Snapshot = serde_json::from_str(include_str!(
        "../../../packages/database/drizzle/meta/0086_snapshot.json"
    ))?;
    #[derive(QueryableByName)]
    struct LedgerExists {
        #[diesel(sql_type = Bool)]
        present: bool,
    }
    #[derive(QueryableByName)]
    struct Version {
        #[diesel(sql_type = Text)]
        version: String,
    }
    let mut versions = Vec::new();
    for schema in ["zc_private", "public"] {
        let present = sql_query(format!(
            "SELECT to_regclass('{schema}.__diesel_schema_migrations') IS NOT NULL AS present"
        ))
        .get_result::<LedgerExists>(connection)
        .await?
        .present;
        if present {
            versions.extend(
                sql_query(format!(
                    "SELECT version::text FROM {schema}.__diesel_schema_migrations"
                ))
                .load::<Version>(connection)
                .await?
                .into_iter()
                .map(|row| row.version),
            );
        }
    }
    apply_migration_overlay(&mut snapshot, &versions);
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

fn apply_migration_overlay(snapshot: &mut Snapshot, versions: &[String]) {
    if versions.iter().any(|version| version == "20260928030000") {
        snapshot
            .tables
            .get_mut("public.zsl_round")
            .unwrap()
            .columns
            .insert(
                "steam_announcement_id".into(),
                SnapshotColumn {
                    name: "steam_announcement_id".into(),
                    data_type: "bigint".into(),
                    not_null: false,
                },
            );
    }
    apply_donations_overlay(snapshot, versions);
    if versions.iter().any(|version| version == "20260927010000") {
        for (table, columns) in [
            (
                "public.zsl_round",
                vec![
                    ("submission_start", "timestamp with time zone", false),
                    ("submission_end", "timestamp with time zone", false),
                    ("zsl_vote_end", "timestamp with time zone", false),
                    ("cosmetic_vote_end", "timestamp with time zone", false),
                ],
            ),
            (
                "zc_private.level_submissions",
                vec![("level_hash", "text", false), ("authors", "text[]", false)],
            ),
            (
                "zc_private.level_submission_contest",
                vec![
                    ("archive_object_key", "text", false),
                    ("archive_sha256", "text", false),
                    ("archive_size", "bigint", false),
                    ("finalized_at", "timestamp with time zone", false),
                ],
            ),
            (
                "zc_private.level_submission_vote",
                vec![
                    ("id", "bigint", true),
                    ("id_contest", "bigint", true),
                    ("id_user", "integer", true),
                    ("id_level", "integer", true),
                    ("vote_type", "smallint", true),
                    ("date_created", "timestamp with time zone", true),
                ],
            ),
        ] {
            let object = snapshot
                .tables
                .entry(table.into())
                .or_insert_with(|| Object {
                    columns: BTreeMap::new(),
                });
            for (name, data_type, not_null) in columns {
                object.columns.insert(
                    name.into(),
                    SnapshotColumn {
                        name: name.into(),
                        data_type: data_type.into(),
                        not_null,
                    },
                );
            }
        }
    }
    if !versions.iter().any(|version| version == "20260928010000") {
        return;
    }
    for (table, removed) in [
        (
            "zc_private.level_submission_contest",
            &[
                "thread_id",
                "guild_id",
                "forum_id",
                "title",
                "theme",
                "season_number",
                "round_number",
                "mapping_source",
                "publication",
            ][..],
        ),
        (
            "zc_private.level_submissions",
            &[
                "message_id",
                "author_id",
                "message_created_at",
                "message_edited_at",
                "source_error",
                "last_seen",
            ][..],
        ),
    ] {
        let object = snapshot
            .tables
            .get_mut(table)
            .expect("frozen submission table");
        object
            .columns
            .retain(|_, column| !removed.contains(&column.name.as_str()));
    }
    snapshot
        .tables
        .get_mut("zc_private.level_submission_contest")
        .unwrap()
        .columns
        .get_mut("id_zsl_round")
        .unwrap()
        .not_null = true;
    for (table, name, data_type, not_null) in [
        (
            "zc_private.level_submission_contest",
            "next_finalization_at",
            "timestamp with time zone",
            true,
        ),
        (
            "zc_private.level_submission_contest",
            "playlist_revision",
            "bigint",
            true,
        ),
        (
            "zc_private.level_submission_contest",
            "published_revision",
            "bigint",
            true,
        ),
        ("zc_private.level_submissions", "authors", "text[]", true),
        ("zc_private.level_submissions", "revision", "bigint", true),
        (
            "zc_private.level_submissions",
            "next_inspection_at",
            "timestamp with time zone",
            true,
        ),
        (
            "zc_private.level_submissions",
            "inspection_started_at",
            "timestamp with time zone",
            false,
        ),
        (
            "zc_private.level_submission_validation",
            "submission_revision",
            "bigint",
            true,
        ),
    ] {
        snapshot.tables.get_mut(table).unwrap().columns.insert(
            name.into(),
            SnapshotColumn {
                name: name.into(),
                data_type: data_type.into(),
                not_null,
            },
        );
    }
    let columns = [
        ("id_submission", "bigint", true),
        ("desired_revision", "bigint", true),
        ("desired_validation_id", "bigint", false),
        ("delivered_revision", "bigint", false),
        ("delivered_validation_id", "bigint", false),
        ("message_id", "text", false),
        ("payload_digest", "text", false),
        ("attempt_started_at", "timestamp with time zone", false),
        ("next_attempt_at", "timestamp with time zone", true),
        ("last_error", "text", false),
        ("date_updated", "timestamp with time zone", true),
    ]
    .into_iter()
    .map(|(name, data_type, not_null)| {
        (
            name.into(),
            SnapshotColumn {
                name: name.into(),
                data_type: data_type.into(),
                not_null,
            },
        )
    })
    .collect();
    snapshot.tables.insert(
        "zc_private.level_submission_notification".into(),
        Object { columns },
    );
}

fn apply_donations_overlay(snapshot: &mut Snapshot, versions: &[String]) {
    if !versions.iter().any(|version| version == "20260928020000") {
        return;
    }
    let columns = [
        ("message_id", "uuid", true),
        ("timestamp", "timestamp with time zone", true),
        ("type", "text", true),
        ("is_public", "boolean", true),
        ("url", "text", true),
        ("is_subscription_payment", "boolean", true),
        ("is_first_subscription_payment", "boolean", true),
        ("kofi_transaction_id", "uuid", true),
        ("tier_name", "text", false),
        ("discord_userid", "bigint", false),
    ];
    let object = |columns: &[(&str, &str, bool)]| Object {
        columns: columns
            .iter()
            .map(|&(name, data_type, not_null)| {
                (
                    name.to_owned(),
                    SnapshotColumn {
                        name: name.to_owned(),
                        data_type: data_type.to_owned(),
                        not_null,
                    },
                )
            })
            .collect(),
    };
    snapshot
        .tables
        .insert("zc_private.donations".into(), object(&columns));
    snapshot.views.insert(
        "public.donations".into(),
        object(&[
            ("is_subscription_payment", "boolean", false),
            ("tier_name", "text", false),
            ("discord_userid", "bigint", false),
        ]),
    );
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
