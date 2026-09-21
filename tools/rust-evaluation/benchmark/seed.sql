-- Only run inside the dedicated benchmark container, never the interactive preview.
TRUNCATE public.record_audit, public.record, public.level, public."user" RESTART IDENTITY CASCADE;
INSERT INTO public."user" (steam_id, steam_name, banned)
SELECT 76561198000000000::bigint + i, 'Benchmark Racer ' || i, i % 101 = 0 FROM generate_series(1,20000) i;
INSERT INTO public.level (name, xx_hash)
SELECT 'Benchmark Level ' || i, md5(i::text) FROM generate_series(1,2000) i;
INSERT INTO public.record (id_user, id_level, time)
SELECT 1 + ((i::bigint * 7919) % 20000)::integer,
 CASE WHEN i <= 400000 THEN 1 + (i % 20) ELSE 21 + (i % 1980) END,
 20 + (i % 100000)::double precision / 1000
FROM generate_series(1,1000000) i;
ANALYZE;
