SELECT count(*)::int FROM public.level_item WHERE id<=201
        AND updated_at>'2000-01-01' AND date_updated IS NOT NULL
