use anyhow::{Result, ensure};
use std::collections::BTreeMap;

const COUNT_CHANGES: &str = include_str!("fixtures/adventure_medal_times/count_changes.sql");
const SELECT_VALIDATION_TIME_GOLD_LEVEL_ITEM: &str =
    include_str!("fixtures/adventure_medal_times/select_validation_time_gold_level_item.sql");

const UP: &str = include_str!("../migrations/20261110010000_adventure_medal_times/up.sql");
const DOWN: &str = include_str!("../migrations/20261110010000_adventure_medal_times/down.sql");
// Exact serialized v18.2 scriptable asset values, independently readable without Unity exports.
const SOURCE: &str = include_str!("fixtures/adventure_medal_times.csv");

fn source_times() -> BTreeMap<&'static str, [f32; 4]> {
    let mut rows = BTreeMap::new();
    for line in SOURCE.lines().skip(1) {
        let fields: Vec<_> = line.split(',').collect();
        assert_eq!(fields.len(), 5);
        let times = std::array::from_fn(|i| fields[i + 1].parse::<f32>().unwrap());
        assert!(times.iter().all(|value| value.is_finite() && *value > 0.0));
        assert!(times.windows(2).all(|pair| pair[0] <= pair[1]));
        assert!(rows.insert(fields[0], times).is_none());
    }
    rows
}

#[test]
fn exact_source_values_cover_every_official_uid_in_both_directions() {
    let source = source_times();
    let map: BTreeMap<_, _> = include_str!("../../../data/adventureLevels/map.csv")
        .trim_start_matches('\u{feff}')
        .lines()
        .skip(1)
        .filter(|line| !line.is_empty())
        .map(|line| line.split_once(',').unwrap())
        .collect();
    assert_eq!(source.len(), 120);
    assert_eq!(
        source.keys().collect::<Vec<_>>(),
        map.keys().collect::<Vec<_>>()
    );
    assert_eq!(source["ea1"], [40.10766, 44.0, 48.0, 90.0]);
    assert_eq!(source["CL01"], [34.642, 38.1062, 41.5704, 46.7667]);
    for sql in [UP, DOWN] {
        let tuples: BTreeMap<_, _> = sql
            .lines()
            .filter_map(|line| {
                line.trim().strip_prefix("('").map(|row| {
                    let (uid, values) = row.split_once("', ").unwrap();
                    let fields: Vec<_> = values
                        .trim_end_matches(',')
                        .trim_end_matches(')')
                        .split(", ")
                        .collect();
                    assert_eq!(fields.len(), 4);
                    let times: [f32; 4] = std::array::from_fn(|i| {
                        fields[i].strip_suffix("::real").unwrap().parse().unwrap()
                    });
                    (uid, times)
                })
            })
            .collect();
        assert_eq!(
            sql.lines()
                .filter(|line| line.trim().starts_with("('"))
                .count(),
            120
        );
        assert_eq!(tuples, source);
    }
}

#[tokio::test]
#[ignore = "requires disposable local adventure_medal_times_test database"]
async fn exact_real_values_alias_scope_idempotency_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_medal_times_test",
        "Dedicated local medal test database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure medal test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(include_str!(
        "fixtures/adventure_medal_times/create_level.sql"
    ))
    .await?;
    let source = source_times();
    for (index, uid) in source.keys().enumerate() {
        tx.execute(
            include_str!("fixtures/adventure_medal_times/insert_level_item.sql"),
            &[&((index + 1) as i32), uid],
        )
        .await?;
    }
    tx.batch_execute(include_str!(
        "fixtures/adventure_medal_times/insert_level_item_2.sql"
    ))
    .await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(COUNT_CHANGES, &[]).await?.get::<_, i32>(0),
        121
    );
    let rows = tx
        .query(
            include_str!("fixtures/adventure_medal_times/select_file_uid_level_item.sql"),
            &[],
        )
        .await?;
    for row in rows {
        let uid: String = row.get(0);
        assert_eq!(
            std::array::from_fn::<_, 4, _>(|i| row.get::<_, f32>(i + 1)),
            source[uid.as_str()]
        );
    }
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(COUNT_CHANGES, &[]).await?.get::<_, i32>(0),
        121
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/count_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/count_level_item_by_before_id.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        121
    );
    tx.batch_execute(include_str!(
        "fixtures/adventure_medal_times/set_validation_time_gold_level_item.sql"
    ))
    .await?;
    // Excluded aliases must survive rollback even when their values match the imported tuple.
    tx.batch_execute(include_str!(
        "fixtures/adventure_medal_times/set_validation_time_author_level_item.sql"
    ))
    .await?;
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/count_level_item_by_after_id.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/count_level_item_by_before_id_2.sql"),
            &[]
        )
        .await?
        .get::<_, i32>(0),
        120
    );
    assert_eq!(
        tx.query_one(SELECT_VALIDATION_TIME_GOLD_LEVEL_ITEM, &[])
            .await?
            .get::<_, f32>(0),
        999.0
    );
    let count: i32 = tx.query_one(COUNT_CHANGES, &[]).await?.get(0);
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(COUNT_CHANGES, &[]).await?.get::<_, i32>(0),
        count
    );
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(SELECT_VALIDATION_TIME_GOLD_LEVEL_ITEM, &[])
            .await?
            .get::<_, f32>(0),
        44.0
    );
    assert!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/select_deleted_level_item.sql"),
            &[]
        )
        .await?
        .get::<_, bool>(0)
    );
    assert_eq!(
        tx.query_one(
            include_str!("fixtures/adventure_medal_times/select_hash_level.sql"),
            &[]
        )
        .await?
        .get::<_, String>(0),
        "preserved"
    );
    tx.rollback().await?;
    Ok(())
}
