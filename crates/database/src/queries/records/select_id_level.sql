SELECT id,hash,xx_hash,adventure,has_records,record_count,publicly_visible FROM public.level WHERE hash=$1 ORDER BY id LIMIT 1 FOR UPDATE
