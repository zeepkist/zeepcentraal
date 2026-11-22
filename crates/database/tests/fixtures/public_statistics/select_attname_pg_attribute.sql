SELECT attname FROM pg_attribute WHERE attrelid='public.global_metric_summary'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum
