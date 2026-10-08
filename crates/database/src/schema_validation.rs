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
