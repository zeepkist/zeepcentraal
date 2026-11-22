
SELECT (to_jsonb(v)-'checked_metadata_at') || jsonb_build_object('id',v.id::text,'id_level',v.id_level::text,'level_xx_hash',l.xx_hash,'report',v.report || jsonb_build_object('status',v.status,'validatorVersion',v.validator_version)) AS data
FROM zc_private.record_validation v JOIN public.level l ON l.id=v.id_level
WHERE v.id>$1
  AND ($2::integer IS NULL OR v.id_record=$2)
  AND ($3::text IS NULL OR v.status=$3)
  AND ($4::integer IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.id_level=$4))
  AND ($5::bigint IS NULL OR EXISTS(SELECT 1 FROM public.level_item o WHERE o.id_level=v.id_level AND o.workshop_id=$5))
  AND ($6::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created >= $6::timestamptz))
  AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM public.record r WHERE r.id=v.id_record AND r.date_created < $7::timestamptz))
ORDER BY v.id LIMIT 100
