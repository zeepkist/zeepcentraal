diesel::table! {
 zc_private.record_history_fact (id) {
  id -> Integer,
  time -> Float,
  date_created -> Timestamptz,
  level_id -> Integer,
  user_id -> Integer,
  level_position -> Nullable<Integer>,
  contribution_rank -> Nullable<Integer>,
  level_points -> Nullable<Integer>,
  level_decayed_points -> Nullable<Float>,
  player_decayed_points -> Nullable<Float>,
  is_personal_best -> Bool,
  is_world_record -> Bool,
  has_contribution -> Bool,
  record_eligible -> Bool,
 }
}

diesel::table! {
 zc_private.history_fact_rollout (singleton) {
  singleton -> Bool,
  backfill_after -> Integer,
  backfill_done -> Bool,
  verify_after -> Integer,
  verified -> Bool,
  original_view -> Text,
  switched_at -> Nullable<Timestamptz>,
 }
}

diesel::table! {
 zc_private.history_fact_dirty (id) {
  id -> Integer,
 }
}

diesel::table! {
 zc_private.global_metrics_snapshot (singleton) {
  singleton -> Bool,
  semantics_version -> Integer,
  records -> BigInt,
  records_today -> BigInt,
  records_month -> BigInt,
  personal_bests -> BigInt,
  personal_bests_today -> BigInt,
  personal_bests_month -> BigInt,
  world_records -> BigInt,
  world_records_today -> BigInt,
  world_records_month -> BigInt,
  levels -> BigInt,
  levels_today -> BigInt,
  levels_month -> BigInt,
  votes -> BigInt,
  votes_today -> BigInt,
  votes_month -> BigInt,
  players -> BigInt,
  players_all -> BigInt,
  ranked_players -> BigInt,
  active_players_today -> BigInt,
  active_players_month -> BigInt,
  as_of -> Timestamptz,
  day_start -> Timestamptz,
  month_start -> Timestamptz,
  time_zone -> Text,
 }
}

diesel::table! {
 zc_private.record_validation (id) {
  id -> BigInt,
  id_record -> Integer,
  id_user -> Integer,
  id_level -> Integer,
  ghost_digest -> Nullable<Text>,
  status -> Text,
  report -> Jsonb,
  validator_version -> Text,
  created_at -> Timestamptz,
  updated_at -> Timestamptz,
  checked_at -> Nullable<Timestamptz>,
  checked_metadata_at -> Timestamptz,
 }
}

diesel::table! {
 zc_private.record_run (id_user, run_uuid) {
  id_user -> Integer,
  run_uuid -> Text,
  payload_digest -> Text,
  id_record -> Integer,
 }
}
