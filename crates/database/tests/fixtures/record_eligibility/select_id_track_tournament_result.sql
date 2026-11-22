SELECT r.id FROM public.track_tournament_result t LEFT JOIN public.record r ON r.id=t.id_record WHERE t.id_tournament=2
