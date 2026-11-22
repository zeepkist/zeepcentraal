EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM public.track_tournament_overall_standing WHERE type=0 ORDER BY total_points DESC,id_user LIMIT 50
