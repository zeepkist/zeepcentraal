use anyhow::{Result, ensure};
use zc_database::{Database, services::donations::DonationInput};

const UP: &str = include_str!("../migrations/20260928020000_kofi_donations/up.sql");
const DOWN: &str = include_str!("../migrations/20260928020000_kofi_donations/down.sql");

#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires disposable PostgreSQL named support_test with adopted schema"]
async fn stores_idempotently_and_exposes_only_public_supporters() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    ensure!(
        url::Url::parse(&url)?.path() == "/support_test",
        "Dedicated disposable database required"
    );
    let applied = zc_database::migrations::run_pending(&url).await?;
    assert!(applied.iter().any(|version| version == "20260928020000"));
    assert!(zc_database::migrations::run_pending(&url).await?.is_empty());
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    zc_database::adoption::run(
        &url,
        &root.join("packages/database/drizzle"),
        zc_database::adoption::Mode::Verify,
    )
    .await?;
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    // Exercise down/up inside a transaction; existing fixtures remain intact.
    client.batch_execute("BEGIN").await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client.batch_execute("ROLLBACK").await?;
    let database = Database::connect(&url, 2).await?;
    let mut payment = DonationInput {
        message_id: "00000000-0000-4000-8000-000000000001".into(),
        timestamp: "2026-01-01T00:00:00Z".into(),
        payment_type: "Tip".into(),
        is_public: true,
        url: "https://example.com/payment".into(),
        is_subscription_payment: false,
        is_first_subscription_payment: false,
        kofi_transaction_id: "00000000-0000-4000-8000-000000000002".into(),
        tier_name: None,
        discord_userid: Some(12345678901234567),
    };
    client
        .batch_execute("TRUNCATE zc_private.donations")
        .await?;
    let (first, second) = tokio::join!(
        database.record_kofi_donation(&payment),
        database.record_kofi_donation(&payment)
    );
    assert_ne!(first?, second?);
    assert!(!database.record_kofi_donation(&payment).await?);
    // A different message for the same transaction is also idempotent.
    payment.message_id = "00000000-0000-4000-8000-000000000003".into();
    assert!(!database.record_kofi_donation(&payment).await?);
    client.batch_execute(r#"
INSERT INTO zc_private.donations(message_id,timestamp,type,is_public,url,is_subscription_payment,is_first_subscription_payment,kofi_transaction_id,tier_name,discord_userid) VALUES
('00000000-0000-4000-8000-000000000010',now()-interval '1 day','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000110','Bronze',12345678901234567),
('00000000-0000-4000-8000-000000000011',now()-interval '1 day','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000111','Silver',12345678901234567),
('00000000-0000-4000-8000-000000000012',now(),'Tip',true,'https://example.com',false,false,'00000000-0000-4000-8000-000000000112',null,12345678901234567),
('00000000-0000-4000-8000-000000000013',now(),'Subscription',false,'https://example.com',true,false,'00000000-0000-4000-8000-000000000113','Private',12345678901234567),
('00000000-0000-4000-8000-000000000014',now(),'Tip',false,'https://example.com',false,false,'00000000-0000-4000-8000-000000000114',null,22345678901234567),
('00000000-0000-4000-8000-000000000015',now(),'Tip',true,'https://example.com',false,false,'00000000-0000-4000-8000-000000000115',null,null),
('00000000-0000-4000-8000-000000000016',now()-interval '36 days','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000116',null,32345678901234567);
"#).await?;
    let rows = client.query("SELECT discord_userid,is_subscription_payment,tier_name FROM public.donations ORDER BY discord_userid", &[]).await?;
    assert_eq!(rows.len(), 2);
    assert!(rows[0].get::<_, bool>(1));
    assert_eq!(
        rows[0].get::<_, Option<String>>(2).as_deref(),
        Some("Silver")
    );
    assert!(!rows[1].get::<_, bool>(1));
    // Strict 35-day boundary and exclusion of future monthly payments.
    client.batch_execute("BEGIN; UPDATE zc_private.donations SET timestamp=now()-interval '35 days' WHERE discord_userid=12345678901234567 AND is_subscription_payment").await?;
    assert!(!client.query_one("SELECT is_subscription_payment FROM public.donations WHERE discord_userid=12345678901234567", &[]).await?.get::<_, bool>(0));
    client.batch_execute("UPDATE zc_private.donations SET timestamp=now()+interval '1 day' WHERE discord_userid=12345678901234567 AND is_subscription_payment").await?;
    assert!(!client.query_one("SELECT is_subscription_payment FROM public.donations WHERE discord_userid=12345678901234567", &[]).await?.get::<_, bool>(0));
    client.batch_execute("ROLLBACK").await?;
    // Donation arrives before linking. Current association is resolved on read.
    client.batch_execute(r#"INSERT INTO public."user" (id,steam_id,steam_name,discord_id) VALUES(900001,76561198000000001,'Fake supporter',NULL);
UPDATE public."user" SET discord_id=12345678901234567 WHERE id=900001;"#).await?;
    assert!(client.query_one(r#"SELECT (public.user_donation(u)).is_subscription_payment FROM public."user" u WHERE id=900001"#, &[]).await?.get::<_, bool>(0));
    client
        .batch_execute(r#"UPDATE public."user" SET discord_id=-1 WHERE id=900001"#)
        .await?;
    assert!(
        client
            .query_one(
                r#"SELECT public.user_donation(u) IS NULL FROM public."user" u WHERE id=900001"#,
                &[]
            )
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute("SET ROLE zeepcentraal_graphql")
        .await?;
    assert_eq!(
        client
            .query("SELECT * FROM public.donations", &[])
            .await?
            .len(),
        2
    );
    assert!(
        client
            .query("SELECT * FROM zc_private.donations", &[])
            .await
            .is_err()
    );
    assert!(
        client
            .execute("DELETE FROM public.donations", &[])
            .await
            .is_err()
    );
    client.batch_execute("RESET ROLE").await?;
    let columns: Vec<String> = client.query("SELECT column_name::text FROM information_schema.columns WHERE table_schema='public' AND table_name='donations' ORDER BY ordinal_position", &[]).await?.iter().map(|row| row.get(0)).collect();
    assert_eq!(
        columns,
        ["is_subscription_payment", "tier_name", "discord_userid"]
    );
    client
        .batch_execute(
            r#"DELETE FROM public."user" WHERE id=900001; TRUNCATE zc_private.donations"#,
        )
        .await?;
    Ok(())
}
