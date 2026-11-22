
WITH records AS MATERIALIZED (
 SELECT r.id,r.id_level FROM public.record r
 WHERE r.id>$1 AND r.id<=$8
   AND CASE WHEN $14 THEN EXISTS(SELECT 1 FROM zc_private.record_validation terminal WHERE terminal.id_record=r.id AND zc_private.is_timing_failure(terminal.status,terminal.validator_version,terminal.report)) ELSE NOT EXISTS(SELECT 1 FROM zc_private.record_validation terminal WHERE terminal.id_record=r.id AND terminal.status='fail') END
   AND ($2::integer IS NULL OR r.id=$2)
   AND ($3::integer IS NULL OR r.id_level=$3)
   AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=r.id_level AND o.workshop_id=$4))
   AND ($5::text IS NULL OR r.date_created >= $5::timestamptz)
   AND ($6::text IS NULL OR r.date_created < $6::timestamptz)
 AND (r.id_level,r.id)>($10,$11)
 AND (cardinality($12::integer[])=0 OR r.id_level=ANY($12))
 AND (cardinality($13::integer[])=0 OR r.id=ANY($13))
 ORDER BY r.id_level,r.id LIMIT 1000
)
SELECT r.id,r.id_level,l.xx_hash AS canonical_hash,l.validation_inputs_updated_at::text AS checked_at,l.validation_metadata_updated_at::text AS checked_metadata_at,
 EXISTS(SELECT 1 FROM public.record_media m WHERE m.id_record=r.id AND nullif(btrim(m.ghost_url),'') IS NOT NULL) AS has_ghost,
 ((cardinality($7::text[])=0 OR coalesce(v.report->'reasons' ?| $7,false))
  AND CASE WHEN $14 THEN zc_private.is_timing_failure(v.status,v.validator_version,v.report) WHEN v.status='fail' THEN false
       WHEN v.status='uncertain' THEN l.validation_metadata_updated_at>v.checked_metadata_at
       ELSE v.id IS NULL OR v.checked_at IS NULL OR v.validator_version<>$9
         OR v.id_level<>r.id_level OR l.validation_inputs_updated_at IS DISTINCT FROM v.checked_at
       END) AS needs_check
FROM records r JOIN public.level l ON l.id=r.id_level
LEFT JOIN zc_private.record_validation v ON v.id_record=r.id
ORDER BY r.id_level,r.id
