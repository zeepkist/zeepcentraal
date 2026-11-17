//! Private queue schema, managed by Diesel migrations. Never exposed through GraphQL.
diesel::table! {
    zc_jobs.job (lane, id) {
        lane -> Text,
        id -> Int8,
        task -> Text,
        payload -> Jsonb,
        job_key -> Nullable<Text>,
        lock_group -> Nullable<Text>,
        attempts -> Int4,
        max_attempts -> Int4,
        generation -> Int8,
        running -> Bool,
        lease_until -> Nullable<Timestamptz>,
        traceparent -> Nullable<Text>,
        tracestate -> Nullable<Text>,
    }
}
