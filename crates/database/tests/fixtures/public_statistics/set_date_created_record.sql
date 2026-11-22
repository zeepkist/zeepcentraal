
      UPDATE public.record SET date_created=CASE id WHEN 1 THEN '2026-10-16 23:00Z'::timestamptz
        WHEN 2 THEN '2026-10-17 22:59:59.999999Z'::timestamptz
        WHEN 3 THEN '2026-10-17 23:00Z'::timestamptz
        WHEN 4 THEN '2026-08-31 23:00Z'::timestamptz ELSE date_created END;
      UPDATE public.vote SET date_created=CASE id_user WHEN 1 THEN '2026-10-16 23:00Z'::timestamptz ELSE '2026-08-31 23:00Z'::timestamptz END;
      UPDATE public.level SET date_created=CASE id WHEN 1 THEN '2026-10-16 23:00Z'::timestamptz ELSE '2026-08-31 23:00Z'::timestamptz END;
      SELECT pg_temp.capture_metrics('2026-10-18 12:00Z');
