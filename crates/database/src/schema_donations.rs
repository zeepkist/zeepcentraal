//! Additive Ko-fi schema after the frozen Drizzle baseline.
diesel::table! {
    zc_private.donations (message_id) {
        message_id -> Uuid,
        timestamp -> Timestamptz,
        r#type -> Text,
        is_public -> Bool,
        url -> Text,
        is_subscription_payment -> Bool,
        is_first_subscription_payment -> Bool,
        kofi_transaction_id -> Uuid,
        tier_name -> Nullable<Text>,
        discord_userid -> Nullable<BigInt>,
    }
}
