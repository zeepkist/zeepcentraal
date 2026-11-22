UPDATE public.zsl_round SET event_date = clock_timestamp() + interval '10 minutes' WHERE id = $1
