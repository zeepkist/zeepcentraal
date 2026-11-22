INSERT INTO public.zsl_points_structure (name, points, minimum_points, best_of)
SELECT name, points, "minimumPoints", "bestOf"
FROM jsonb_to_record($1) AS input(name text, points integer[], "minimumPoints" integer, "bestOf" integer)
RETURNING id
