CREATE FUNCTION public.hot_levels_since("since" timestamptz)
RETURNS SETOF public.level
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
	SELECT level.*
	FROM public.level
	INNER JOIN public.record ON public.record.id_level = public.level.id
	WHERE public.record.date_created >= "since"
		AND EXISTS (
			SELECT 1
			FROM public.level_item
			WHERE public.level_item.id_level = public.level.id
				AND public.level_item.deleted = false
		)
	GROUP BY public.level.id
	ORDER BY count(public.record.id) DESC, public.level.id ASC;
$$;
