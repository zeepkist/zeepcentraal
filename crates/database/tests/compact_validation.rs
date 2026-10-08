use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Jsonb},
};
use diesel_async::{RunQueryDsl, SimpleAsyncConnection};
use serde_json::Value;
use zc_database::Database;
#[derive(QueryableByName)]
struct Data {
    #[diesel(sql_type=Jsonb)]
    data: Value,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=BigInt)]
    count: i64,
}
#[derive(QueryableByName)]
struct Record {
    #[diesel(sql_type=Integer)]
    id: i32,
}
#[tokio::test]
#[ignore = "requires local ghost_validation_batch_compact_test cloned historical fixture"]
async fn compaction_preserves_observations_responses_and_noop_writes() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/ghost_validation_batch_compact_test",
        "Dedicated fixture required"
    );
    let db = Database::connect(&url, 2).await?;
    let mut connection = db.pool_partition().connection().await?;
    let id =
        sql_query("SELECT id_record AS id FROM zc_private.record_validation ORDER BY id LIMIT 1")
            .get_result::<Record>(&mut connection)
            .await?
            .id;
    let before=sql_query("SELECT jsonb_agg(to_jsonb(v)-'report' ORDER BY id) AS data FROM zc_private.record_validation v").get_result::<Data>(&mut connection).await?.data;
    let report = db.record_validation_attempts(id).await?.remove(0);
    connection
        .batch_execute(include_str!(
            "../migrations/20261008050000_compact_validation_reports/up.sql"
        ))
        .await?;
    assert_eq!(sql_query("SELECT count(*) AS count FROM zc_private.record_validation WHERE report ?| ARRAY['status','validatorVersion','validator_version']").get_result::<Count>(&mut connection).await?.count,0);
    assert_eq!(report, db.record_validation_attempts(id).await?[0]);
    let parsed = serde_json::from_value(report["report"].clone())?;
    db.save_record_validation(id, None, &parsed).await?;
    assert_eq!(before,sql_query("SELECT jsonb_agg(to_jsonb(v)-'report' ORDER BY id) AS data FROM zc_private.record_validation v").get_result::<Data>(&mut connection).await?.data);
    connection
        .batch_execute(include_str!(
            "../migrations/20261008050000_compact_validation_reports/down.sql"
        ))
        .await?;
    assert_eq!(report, db.record_validation_attempts(id).await?[0]);
    connection
        .batch_execute(include_str!(
            "../migrations/20261008050000_compact_validation_reports/up.sql"
        ))
        .await?;
    Ok(())
}
