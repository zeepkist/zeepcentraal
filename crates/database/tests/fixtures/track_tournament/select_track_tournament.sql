
SELECT (SELECT count(*)=10 FROM public.track_tournament)
   AND (SELECT bool_and(
       to_jsonb(t)-'slug'=to_jsonb(o)-'slug'
       AND t.slug=CASE WHEN o.id_level<=4 THEN replace(o.slug,'W','w') ELSE o.slug END
   ) FROM public.track_tournament t JOIN original_tournaments o USING(id))
   AND NOT EXISTS(
       (SELECT * FROM public.track_tournament_result EXCEPT SELECT * FROM original_results)
       UNION ALL
       (SELECT * FROM original_results EXCEPT SELECT * FROM public.track_tournament_result)
   ) AS value
