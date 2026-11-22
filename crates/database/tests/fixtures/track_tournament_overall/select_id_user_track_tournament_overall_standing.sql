SELECT id_user,total_points,events_played,rank FROM public.track_tournament_overall_standing WHERE type=$1 ORDER BY total_points DESC,id_user
