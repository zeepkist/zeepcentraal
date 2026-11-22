SELECT NOT EXISTS((SELECT * FROM public.track_tournament EXCEPT SELECT * FROM once_repaired) UNION ALL (SELECT * FROM once_repaired EXCEPT SELECT * FROM public.track_tournament)) AS value
