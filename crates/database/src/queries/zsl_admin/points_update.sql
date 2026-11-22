UPDATE public.zsl_points_structure p
SET name = input.name, points = input.points, minimum_points = input."minimumPoints",
    best_of = input."bestOf", date_updated = clock_timestamp()
FROM jsonb_to_record($1) AS input(name text, points integer[], "minimumPoints" integer, "bestOf" integer)
WHERE p.id = $2 AND coalesce(p.date_updated, p.date_created) = $3::timestamptz
AND ((p.points, p.minimum_points, p.best_of) IS NOT DISTINCT FROM (input.points, input."minimumPoints", input."bestOf")
    OR NOT EXISTS (
        SELECT FROM public.zsl_season s JOIN public.zsl_round r ON r.id_season = s.id
        WHERE s.id_points_structure = p.id AND (r.event_date <= clock_timestamp() + interval '20 minutes'
            OR EXISTS (SELECT FROM public.zsl_round_result result WHERE result.id_round = r.id))))
RETURNING p.id
