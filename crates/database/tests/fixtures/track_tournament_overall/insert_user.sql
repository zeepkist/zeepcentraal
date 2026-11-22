INSERT INTO public."user" SELECT i,'Plan player' FROM generate_series(1000,21000) i;
        INSERT INTO public.track_tournament_overall_standing SELECT 0,id,1000,1,1 FROM public."user" WHERE id>=1000;
        ANALYZE public.track_tournament_overall_standing
