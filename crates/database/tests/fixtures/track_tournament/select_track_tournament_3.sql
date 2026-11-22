
SELECT NOT EXISTS(
    (SELECT * FROM public.track_tournament EXCEPT SELECT * FROM original_tournaments)
    UNION ALL (SELECT * FROM original_tournaments EXCEPT SELECT * FROM public.track_tournament)
) AND NOT EXISTS(
    (SELECT * FROM public.track_tournament_result EXCEPT SELECT * FROM original_results)
    UNION ALL (SELECT * FROM original_results EXCEPT SELECT * FROM public.track_tournament_result)
) AS value
