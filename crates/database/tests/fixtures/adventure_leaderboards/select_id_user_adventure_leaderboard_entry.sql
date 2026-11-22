SELECT id_user,rank,completed_levels,total_time_ms FROM public.adventure_leaderboard_entry WHERE series='a' ORDER BY completed_levels DESC,total_time_ms,id_user
