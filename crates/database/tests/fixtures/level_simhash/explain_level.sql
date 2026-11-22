EXPLAIN (ANALYZE,BUFFERS,FORMAT TEXT) SELECT id,bit_count(simhash::bit(64) # (-9223372036854775808)::bigint::bit(64)) FROM public.level WHERE publicly_visible=true AND simhash IS NOT NULL
