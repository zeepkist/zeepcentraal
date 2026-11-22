EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM public.adventure_leaderboard_entry WHERE series=$1 ORDER BY completed_levels DESC,total_time_ms,id_user LIMIT 50
