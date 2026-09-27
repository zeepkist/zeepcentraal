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
