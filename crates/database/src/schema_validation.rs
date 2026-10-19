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
