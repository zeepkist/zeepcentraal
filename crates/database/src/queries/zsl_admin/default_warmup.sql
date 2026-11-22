INSERT INTO zc_private.zsl_playlist_revision (round_id, kind)
SELECT $1, 'warmup'
WHERE EXISTS (SELECT FROM public.zsl_round WHERE id = $1 AND event2_date IS NOT NULL)
AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision WHERE round_id = $1 AND kind = 'warmup')
