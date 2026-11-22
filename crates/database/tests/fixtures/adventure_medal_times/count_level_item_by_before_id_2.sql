SELECT count(*)::int FROM public.level_item WHERE id<=120
        AND validation_time_author=0 AND validation_time_gold=0 AND validation_time_silver=0
        AND validation_time_bronze=0
