
INSERT INTO zc_private.record_validation AS existing
 (id_record,id_user,id_level,ghost_digest,status,report,validator_version,checked_at,checked_metadata_at)
SELECT r.id,r.id_user,r.id_level,$2,$3,$4,$5,$6::text::timestamptz,coalesce($7::text::timestamptz,'epoch')
FROM public.record r WHERE r.id=ANY($1) AND ($8::integer IS NULL OR r.id_level=$8) ORDER BY r.id
ON CONFLICT(id_record) DO UPDATE SET
 id_user=EXCLUDED.id_user,id_level=EXCLUDED.id_level,
 ghost_digest=CASE WHEN ROW(existing.status,existing.report-'timingRecovery',existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   THEN EXCLUDED.ghost_digest ELSE existing.ghost_digest END,
 status=EXCLUDED.status,report=EXCLUDED.report || CASE WHEN existing.report ? 'timingRecovery' THEN jsonb_build_object('timingRecovery',existing.report->'timingRecovery') ELSE '{}'::jsonb END,validator_version=EXCLUDED.validator_version,
 updated_at=CASE WHEN ROW(existing.status,existing.report-'timingRecovery',existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   THEN clock_timestamp() ELSE existing.updated_at END,
 checked_at=coalesce(EXCLUDED.checked_at,existing.checked_at),checked_metadata_at=EXCLUDED.checked_metadata_at
WHERE existing.status<>'fail'
 AND (existing.status<>'uncertain' OR EXCLUDED.checked_metadata_at>existing.checked_metadata_at)
 AND (existing.checked_at IS NULL OR EXCLUDED.checked_at IS NULL OR EXCLUDED.checked_at>=existing.checked_at)
 AND (ROW(existing.status,existing.report-'timingRecovery',existing.validator_version)
   IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.report,EXCLUDED.validator_version)
   OR (EXCLUDED.checked_at IS NOT NULL AND existing.checked_at IS DISTINCT FROM EXCLUDED.checked_at)
   OR existing.checked_metadata_at IS DISTINCT FROM EXCLUDED.checked_metadata_at)
