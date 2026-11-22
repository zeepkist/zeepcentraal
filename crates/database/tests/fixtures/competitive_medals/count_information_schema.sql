SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='level_item' AND column_name LIKE 'validation_time_%'
