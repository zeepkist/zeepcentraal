use crate::Database;
use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{BigInt, Bool, Nullable, Text},
};
use diesel_async::RunQueryDsl;

/// Only payment metadata needed for supporter attribution. No secret or payer details.
pub struct DonationInput {
    pub message_id: String,
    pub timestamp: String,
    pub payment_type: String,
    pub is_public: bool,
    pub url: String,
    pub is_subscription_payment: bool,
    pub is_first_subscription_payment: bool,
    pub kofi_transaction_id: String,
    pub tier_name: Option<String>,
    pub discord_userid: Option<i64>,
}

impl Database {
    /// Atomic idempotency across requests, workers, and replicas.
    pub async fn record_kofi_donation(&self, payment: &DonationInput) -> Result<bool> {
        let mut connection = self.connection().await?;
        let inserted = sql_query(
            "INSERT INTO zc_private.donations \
             (message_id,timestamp,type,is_public,url,is_subscription_payment,\
              is_first_subscription_payment,kofi_transaction_id,tier_name,discord_userid) \
             VALUES ($1::uuid,$2::timestamptz,$3,$4,$5,$6,$7,$8::uuid,$9,$10) \
             ON CONFLICT DO NOTHING",
        )
        .bind::<Text, _>(&payment.message_id)
        .bind::<Text, _>(&payment.timestamp)
        .bind::<Text, _>(&payment.payment_type)
        .bind::<Bool, _>(payment.is_public)
        .bind::<Text, _>(&payment.url)
        .bind::<Bool, _>(payment.is_subscription_payment)
        .bind::<Bool, _>(payment.is_first_subscription_payment)
        .bind::<Text, _>(&payment.kofi_transaction_id)
        .bind::<Nullable<Text>, _>(&payment.tier_name)
        .bind::<Nullable<BigInt>, _>(payment.discord_userid)
        .execute(&mut connection)
        .await?;
        Ok(inserted == 1)
    }
}
