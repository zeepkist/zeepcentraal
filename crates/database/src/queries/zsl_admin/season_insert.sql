INSERT INTO public.zsl_season (name, id_points_structure, start_date, end_date)
SELECT name, "pointsStructureId", "startDate", "endDate"
FROM jsonb_to_record($1) AS input(name text, "pointsStructureId" integer, "startDate" timestamptz, "endDate" timestamptz)
WHERE NOT EXISTS (SELECT FROM public.zsl_season WHERE name = input.name)
RETURNING id
