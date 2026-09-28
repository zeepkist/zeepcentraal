//! Additive Diesel schema after the frozen Drizzle baseline in `schema.rs`.

diesel::table! {
    zc_private.level_submission_vote (id) {
        id -> BigInt,
        id_contest -> BigInt,
        id_user -> Integer,
        id_level -> Integer,
        vote_type -> SmallInt,
        date_created -> Timestamptz,
    }
}

// Runtime declarations stay additive; schema.rs remains the adopted baseline.
diesel::table! {
 zc_private.level_submission_notification (id_submission) {
  id_submission -> BigInt,
  desired_revision -> BigInt,
  desired_validation_id -> Nullable<BigInt>,
  delivered_revision -> Nullable<BigInt>,
  delivered_validation_id -> Nullable<BigInt>,
  message_id -> Nullable<Text>,
  payload_digest -> Nullable<Text>,
  attempt_started_at -> Nullable<Timestamptz>,
  next_attempt_at -> Timestamptz,
  last_error -> Nullable<Text>,
  date_updated -> Timestamptz,
 }
}
