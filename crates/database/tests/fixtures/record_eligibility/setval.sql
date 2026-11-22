SELECT setval(pg_get_serial_sequence('public.record','id'),(SELECT max(id) FROM public.record))
