use anyhow::{Result, ensure};
use zc_database::{Database, services::donations::DonationInput};

const ROLLBACK_SQL: &str = include_str!("fixtures/donations/rollback.sql");
const SELECT_IS_SUBSCRIPTION_PAYMENT_DONATIONS: &str =
    include_str!("fixtures/donations/select_is_subscription_payment_donations.sql");

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
    client
        .batch_execute(include_str!("fixtures/donations/begin.sql"))
        .await?;
    client.batch_execute(DOWN).await?;
    client.batch_execute(UP).await?;
    client.batch_execute(ROLLBACK_SQL).await?;
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
        .batch_execute(include_str!("fixtures/donations/truncate_donations.sql"))
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
    client
        .batch_execute(include_str!("fixtures/donations/insert_donations.sql"))
        .await?;
    let rows = client
        .query(
            include_str!("fixtures/donations/select_discord_userid_donations.sql"),
            &[],
        )
        .await?;
    assert_eq!(rows.len(), 2);
    assert!(rows[0].get::<_, bool>(1));
    assert_eq!(
        rows[0].get::<_, Option<String>>(2).as_deref(),
        Some("Silver")
    );
    assert!(!rows[1].get::<_, bool>(1));
    // Strict 35-day boundary and exclusion of future monthly payments.
    client
        .batch_execute(include_str!(
            "fixtures/donations/set_timestamp_donations.sql"
        ))
        .await?;
    assert!(
        !client
            .query_one(SELECT_IS_SUBSCRIPTION_PAYMENT_DONATIONS, &[])
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "fixtures/donations/set_timestamp_donations_by_discord_userid_12345678901234567.sql"
        ))
        .await?;
    assert!(
        !client
            .query_one(SELECT_IS_SUBSCRIPTION_PAYMENT_DONATIONS, &[])
            .await?
            .get::<_, bool>(0)
    );
    client.batch_execute(ROLLBACK_SQL).await?;
    // Donation arrives before linking. Current association is resolved on read.
    client
        .batch_execute(include_str!("fixtures/donations/insert_user.sql"))
        .await?;
    assert!(
        client
            .query_one(include_str!("fixtures/donations/select_user.sql"), &[])
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!("fixtures/donations/set_discord_id_user.sql"))
        .await?;
    assert!(
        client
            .query_one(include_str!("fixtures/donations/user_donation.sql"), &[])
            .await?
            .get::<_, bool>(0)
    );
    client
        .batch_execute(include_str!(
            "fixtures/donations/set_role_zeepcentraal_graphql.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query(include_str!("fixtures/donations/select_donations.sql"), &[])
            .await?
            .len(),
        2
    );
    assert!(
        client
            .query(
                include_str!("fixtures/donations/select_donations_2.sql"),
                &[]
            )
            .await
            .is_err()
    );
    assert!(
        client
            .execute(include_str!("fixtures/donations/delete_donations.sql"), &[])
            .await
            .is_err()
    );
    client
        .batch_execute(include_str!("fixtures/donations/reset_role.sql"))
        .await?;
    let columns: Vec<String> = client
        .query(
            include_str!("fixtures/donations/select_column_name_information_schema.sql"),
            &[],
        )
        .await?
        .iter()
        .map(|row| row.get(0))
        .collect();
    assert_eq!(
        columns,
        ["is_subscription_payment", "tier_name", "discord_userid"]
    );
    client
        .batch_execute(include_str!("fixtures/donations/delete_user.sql"))
        .await?;
    Ok(())
}
