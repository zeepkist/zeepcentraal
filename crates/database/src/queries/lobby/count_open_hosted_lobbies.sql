SELECT count(*) AS count FROM public.lobby WHERE host_id = $1 AND closed_at IS NULL
