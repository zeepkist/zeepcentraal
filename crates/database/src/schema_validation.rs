diesel::table! {
 zc_private.level_version_lineage (id_level, workshop_id, file_uid, source) {
  id_level -> Integer,
  workshop_id -> BigInt,
  file_uid -> Text,
  source -> Text,
  observed_at -> Timestamptz,
 }
}

diesel::table! {
 zc_private.record_validation (id) {
  id -> BigInt,
  id_record -> Nullable<Integer>,
  id_user -> Integer,
  id_level -> Nullable<Integer>,
  ghost_digest -> Nullable<Text>,
  level_xx_hash -> Nullable<Text>,
  status -> Text,
  report -> Jsonb,
  validator_version -> Text,
  created_at -> Timestamptz,
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
