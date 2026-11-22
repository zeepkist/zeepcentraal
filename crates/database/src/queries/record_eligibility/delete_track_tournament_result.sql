DELETE FROM public.track_tournament_result result WHERE id_tournament=$1 AND NOT EXISTS(SELECT 1 FROM eligible_tournament_winners w WHERE w.id_user=result.id_user)
