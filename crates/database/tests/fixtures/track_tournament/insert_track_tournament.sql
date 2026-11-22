
INSERT INTO public.track_tournament(type,slug,id_level,start_at,end_at,finalized_at,date_updated)
SELECT kind,slug,n,statement_timestamp()+offset_days*interval '1 day',
       statement_timestamp()+(offset_days+7)*interval '1 day',
       CASE WHEN finalized THEN statement_timestamp()-interval '1 day' END,
       statement_timestamp()-interval '2 days'
FROM (VALUES
    (1,0,'2026-W41',-1,false),
    (2,0,'2025-W01',-400,false),
    (3,0,'2026-W40',-8,true),
    (4,0,'2027-W01',100,false),
    (5,0,'2026-w39',-15,false),
    (6,1,'2026-10',-2,false),
    (7,1,'2026-W41',-3,false),
    (8,0,'custom-W41',-4,false),
    (9,0,'2026-W1',-5,false),
    (10,0,'2026-W410',-6,false)
) AS fixtures(n,kind,slug,offset_days,finalized);
INSERT INTO public.track_tournament_result
SELECT id,1,100+id,49.332,1,1000 FROM public.track_tournament;
CREATE TEMP TABLE original_tournaments ON COMMIT DROP AS SELECT * FROM public.track_tournament;
CREATE TEMP TABLE original_results ON COMMIT DROP AS SELECT * FROM public.track_tournament_result;
