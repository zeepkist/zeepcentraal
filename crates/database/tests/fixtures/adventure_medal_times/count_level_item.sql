SELECT count(*)::int FROM public.level_item WHERE id>=202
        AND validation_time_author=0 AND validation_time_gold=0 AND validation_time_silver=0
        AND validation_time_bronze=0 AND updated_at='2000-01-01' AND date_updated IS NULL
