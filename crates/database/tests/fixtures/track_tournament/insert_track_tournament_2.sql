
INSERT INTO public.track_tournament(type,slug,id_level,start_at,end_at)
SELECT 0,slug,n,statement_timestamp()+n*interval '1 week',
       statement_timestamp()+(n+1)*interval '1 week'
FROM (VALUES (1,'2026-W40'),(2,'2026-W41'),(3,'2026-w41')) AS fixtures(n,slug);
INSERT INTO public.track_tournament_result
SELECT id,1,100+id,49.332,1,1000 FROM public.track_tournament;
CREATE TEMP TABLE original_tournaments ON COMMIT DROP AS SELECT * FROM public.track_tournament;
CREATE TEMP TABLE original_results ON COMMIT DROP AS SELECT * FROM public.track_tournament_result;
SAVEPOINT before_repair;
