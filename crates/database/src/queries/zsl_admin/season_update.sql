UPDATE public.zsl_season s
SET name = input.name, id_points_structure = input."pointsStructureId", start_date = input."startDate",
    end_date = input."endDate", date_updated = clock_timestamp()
FROM jsonb_to_record($1) AS input(name text, "pointsStructureId" integer, "startDate" timestamptz, "endDate" timestamptz)
WHERE s.id = $2 AND coalesce(s.date_updated, s.date_created) = $3::timestamptz
AND NOT EXISTS (SELECT FROM public.zsl_season other WHERE other.name = input.name AND other.id <> s.id)
AND (s.id_points_structure = input."pointsStructureId" OR NOT EXISTS (
    SELECT FROM public.zsl_round r WHERE r.id_season = s.id
    AND (r.event_date <= clock_timestamp() + interval '20 minutes'
        OR EXISTS (SELECT FROM public.zsl_round_result result WHERE result.id_round = r.id))))
RETURNING s.id
